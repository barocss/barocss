import {
  BooleanExtrusionFeatureGraphDiagnosticCode, BooleanExtrusionFeatureGraphError,
  evaluateBooleanExtrusionFeatureGraph, parseBooleanExtrusionFeatureGraph,
  serializeBooleanExtrusionFeatureGraph, updateBooleanExtrusionFeatureGraph,
  validateBooleanExtrusionFeatureGraph, transactBooleanExtrusionFeatureGraphFeatures, transactBooleanExtrusionFeatureGraphParameters,
} from '@barocss/cad';
import type {
  BooleanExtrusionFeatureGraphEdits, BooleanExtrusionFeatureGraphResult,
  BooleanExtrusionFeatureGraphV0, BooleanExtrusionFeatureTransaction, BooleanExtrusionParameterTransaction, BooleanExtrusionLengthDefinition,
} from '@barocss/cad';
import { deriveBaroCadBooleanExtrusionFeatureMesh } from '@barocss/cad-interop/boolean-extrusion-feature-mesh';
import { CadEditorError } from './types.js';
import type {
  CadEditorFeatureCandidate, CadEditorFeatureDisplay, CadEditorFeatureOutput, CadEditorFeatureParameterDraft,
  CadEditorFeaturePending, CadEditorFeatureSession, CadEditorFeatureSessionOptions,
  CadEditorFeatureSnapshot,
} from './feature-types.js';

const FILE_LIMIT = 1048576;
const HISTORY_LIMIT = 20;
const HISTORY_BYTES = 8 * 1024 * 1024;
const REVISION_LIMIT = 1000000000;
let sessionSequence = 0;

function check(condition: boolean, code: ConstructorParameters<typeof CadEditorError>[0], message: string,
  context: CadEditorError['context'] = {}): asserts condition {
  if (!condition) throw new CadEditorError(code, message, context);
}
/** Copy admitted native CPU data without normalizing authored negative zero. */
function copy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(child => copy(child)) as T;
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copy(child)])) as T;
  return value;
}
function same(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => same(value, right[index]));
  if (left !== null && right !== null && typeof left === 'object' && typeof right === 'object') {
    const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
    return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
  }
  return Object.is(left, right);
}
function native<T>(action: () => T, message: string, context: CadEditorError['context'] = {}): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CadEditorError) throw cause;
    const code = cause instanceof BooleanExtrusionFeatureGraphError
      && cause.code === BooleanExtrusionFeatureGraphDiagnosticCode.REVISION ? 'REVISION' : 'NATIVE';
    throw new CadEditorError(code, message, context, cause);
  }
}
function bytes(text: string): number {
  let count = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) count++;
    else if (code < 0x800) count += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++index);
      check(next >= 0xdc00 && next <= 0xdfff, 'INPUT', 'Unpaired Unicode surrogate is unsupported.');
      count += 4;
    } else {
      check(code < 0xdc00 || code > 0xdfff, 'INPUT', 'Unpaired Unicode surrogate is unsupported.');
      count += 3;
    }
  }
  return count;
}
function fileBudget(text: string): number {
  check(typeof text === 'string', 'INPUT', 'Native authored graph text is required.');
  check(text.length <= FILE_LIMIT, 'BUDGET', 'Graph exceeds 1048576 code units.');
  const count = bytes(text);
  check(count <= FILE_LIMIT, 'BUDGET', 'Graph exceeds 1048576 UTF-8 bytes.');
  return count;
}
function record(input: unknown, fields: string[], field: string): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input)
    && [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'INPUT', 'Plain own data is required.', { field });
  const keys = Reflect.ownKeys(input), descriptors = Object.getOwnPropertyDescriptors(input);
  check(keys.length === fields.length && keys.every(key => typeof key === 'string' && fields.includes(key)
    && 'value' in descriptors[key] && descriptors[key].enumerable === true), 'INPUT', 'Use the exact declared fields.', { field });
  return Object.fromEntries(fields.map(key => [key, descriptors[key].value]));
}
/** Descriptor-safe ownership copy. Native transactions still own all ID/value/dependency semantics. */
function copyRequest<T>(input: T, field = 'extrusion-transaction'): T {
  let remaining = 16384;
  const ancestors = new Set<object>();
  const context = { field };
  const visit = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 12, 'BUDGET', 'Lifecycle request exceeds the own-data budget.', context);
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      check(value.length <= 128, 'BUDGET', 'Lifecycle request strings must have at most 128 characters.', context); return value;
    }
    check(typeof value === 'object', 'INPUT', 'Lifecycle requests require plain own data.', context);
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      'INPUT', 'Lifecycle requests require plain own data.', context);
    check(!ancestors.has(value), 'INPUT', 'Cyclic lifecycle request data is unsupported.', context);
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.length <= (array ? 65 : 16) && keys.every(key => typeof key === 'string' && key.length <= 128
      && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)),
    'INPUT', 'Lifecycle requests cannot contain getters, symbols or hidden fields.', context);
    ancestors.add(value);
    let copied: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(length <= 64 && keys.length === length + 1, 'INPUT', 'Lifecycle request arrays must be bounded and dense.', context);
      copied = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), 'INPUT', 'Lifecycle request arrays must be dense.', context);
        return visit(descriptors[String(index)].value, depth + 1);
      });
    } else copied = Object.fromEntries((keys as string[]).map(key => [key, visit(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return copied;
  };
  return visit(input, 0) as T;
}
function extrusionRequest(input: BooleanExtrusionFeatureTransaction, previous: BooleanExtrusionFeatureGraphResult): BooleanExtrusionFeatureTransaction {
  const own = record(input, ['expectedRevision', 'revision', 'featureOperations'], 'extrusion-transaction');
  check(Array.isArray(own.featureOperations), 'INPUT', 'Use the native feature operation array.', { field: 'extrusion-transaction' });
  for (const operationInput of own.featureOperations) {
    check(operationInput !== null && typeof operationInput === 'object' && !Array.isArray(operationInput),
      'INPUT', 'Use a plain native feature operation.', { field: 'extrusion-transaction' });
    const kind = (operationInput as Record<string, unknown>).kind;
    check(kind === 'upsert' || kind === 'remove', 'UNSUPPORTED', 'Extrusion transactions support Upsert and Remove only.', { field: 'extrusion-transaction' });
    const fields = record(operationInput, kind === 'upsert' ? ['kind', 'feature'] : ['kind', 'featureId'], 'extrusion-transaction');
    if (fields.kind === 'upsert') {
      check(fields.feature !== null && typeof fields.feature === 'object' && !Array.isArray(fields.feature),
        'INPUT', 'Use an authored native extrusion feature.', { field: 'extrusion-transaction' });
      const feature = fields.feature as Record<string, unknown>;
      const starting = previous.document.features.find(row => row.id === feature.id);
      check(feature.kind === 'normal-extrusion' && (starting === undefined || starting.kind === 'normal-extrusion'),
        'UNSUPPORTED', 'Only normal extrusion leaves can be created or edited.', { documentId: previous.document.id, field: 'extrusion-transaction' });
    } else {
      const starting = previous.document.features.find(row => row.id === fields.featureId);
      // Missing/invalid removal IDs reach the actual native transaction's starting-table guard.
      check(starting === undefined || starting.kind === 'normal-extrusion', 'UNSUPPORTED', 'Only starting extrusion leaves can be removed.',
        { documentId: previous.document.id, field: 'extrusion-transaction' });
    }
  }
  return own as unknown as BooleanExtrusionFeatureTransaction;
}
function options(input: CadEditorFeatureSessionOptions): CadEditorFeatureSessionOptions {
  const own = record(input, ['native', 'display', 'mesh'], 'feature-options');
  const display = record(own.display, ['featureId', 'outputSlotId'], 'feature-display');
  check(typeof display.featureId === 'string' && typeof display.outputSlotId === 'string', 'INPUT', 'Choose one explicit extrusion feature and output slot.', { field: 'feature-display' });
  return { native: own.native as CadEditorFeatureSessionOptions['native'],
    display: { featureId: display.featureId, outputSlotId: display.outputSlotId }, mesh: own.mesh as CadEditorFeatureSessionOptions['mesh'] };
}
function serialize(result: BooleanExtrusionFeatureGraphResult): string {
  const text = native(() => serializeBooleanExtrusionFeatureGraph(result.document, result.options),
    'Native graph serialization failed.', { documentId: result.document.id, field: 'feature-file' });
  fileBudget(text); return text;
}
interface OutputConfig {
  featureId: string; outputSlotId: string; mesh: CadEditorFeatureOutput['mesh'];
}
interface DerivedOutputs { displays: CadEditorFeatureDisplay[]; outputs: OutputConfig[] }

function deriveOutputs(result: BooleanExtrusionFeatureGraphResult, inputs: CadEditorFeatureOutput[], field = 'feature-outputs'): DerivedOutputs {
  const context = { documentId: result.document.id, field };
  check(Array.isArray(inputs) && Object.getPrototypeOf(inputs) === Array.prototype,
    'INPUT', 'Display outputs must be a plain array.', context);
  const descriptors = Object.getOwnPropertyDescriptors(inputs), keys = Reflect.ownKeys(inputs);
  check(inputs.length >= 1 && inputs.length <= 4, 'BUDGET', 'Choose 1 through 4 extrusion outputs.', context);
  check(keys.length === inputs.length + 1 && keys.every(key => typeof key === 'string'),
    'INPUT', 'Display outputs must be dense own data.', context);
  const refs = new Set<string>(), meshIds = new Set<string>();
  const rows = Array.from({ length: inputs.length }, (_, index) => {
    const descriptor = descriptors[String(index)];
    check(descriptor !== undefined && 'value' in descriptor && descriptor.enumerable === true,
      'INPUT', 'Display outputs must be dense own data.', context);
    const input = record(descriptor.value, ['selection', 'mesh'], field);
    // The existing interop selector owns current graph/revision/feature/slot admission.
    const derived = native(() => deriveBaroCadBooleanExtrusionFeatureMesh(result,
      input.selection as CadEditorFeatureOutput['selection'], input.mesh as CadEditorFeatureOutput['mesh']),
    'Native qualified extrusion mesh admission failed.', context);
    const { binding, nativeMesh } = derived;
    const selection = { graphId: binding.graphId, revision: binding.revision,
      featureId: binding.featureId, outputSlotId: binding.outputSlotId };
    const key = JSON.stringify([selection.graphId, selection.revision, selection.featureId, selection.outputSlotId]);
    check(!refs.has(key), 'INPUT', 'Display outputs must have unique native references.', context); refs.add(key);
    const meshId = nativeMesh.options.meshId;
    // Native mesh admission already enforces the original ASCII ID limit of 12.
    check(!meshIds.has(meshId), 'INPUT', 'Use a unique explicit mesh ID for each display output.', context); meshIds.add(meshId);
    return { display: { selection, binding, nativeMesh } satisfies CadEditorFeatureDisplay,
      output: { featureId: selection.featureId, outputSlotId: selection.outputSlotId, mesh: copy(nativeMesh.options) } };
  });
  rows.sort((a, b) => result.document.features.findIndex(feature => feature.id === a.output.featureId)
    - result.document.features.findIndex(feature => feature.id === b.output.featureId));
  serialize(result);
  return { displays: rows.map(row => row.display), outputs: rows.map(row => row.output) };
}
function deriveSingle(result: BooleanExtrusionFeatureGraphResult, input: CadEditorFeatureSessionOptions): DerivedOutputs {
  return deriveOutputs(result, [{ selection: { graphId: result.document.id, revision: result.document.revision,
    featureId: input.display.featureId, outputSlotId: input.display.outputSlotId }, mesh: input.mesh }], 'feature-display');
}
function deriveCurrent(result: BooleanExtrusionFeatureGraphResult, outputs: OutputConfig[]): DerivedOutputs {
  return deriveOutputs(result, outputs.map(output => ({
    selection: { graphId: result.document.id, revision: result.document.revision, featureId: output.featureId, outputSlotId: output.outputSlotId },
    mesh: output.mesh,
  })));
}
function viewOptions(result: BooleanExtrusionFeatureGraphResult, outputs: OutputConfig[]): CadEditorFeatureSessionOptions {
  const first = outputs[0];
  return { native: copy(result.options), display: { featureId: first.featureId, outputSlotId: first.outputSlotId }, mesh: copy(first.mesh) };
}
function parseScalar(text: string, context: CadEditorError['context']): number {
  const trimmed = text.trim();
  check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed), 'INPUT', 'Enter a decimal or exponent number.', context);
  const value = Number(trimmed);
  check(Number.isFinite(value), 'INPUT', 'The authored length must be finite.', context);
  return value;
}
function nextRevision(value: number): number {
  check(value < REVISION_LIMIT, 'REVISION', 'Native graph revision limit reached.');
  return value + 1;
}
function emptyPending(): CadEditorFeaturePending { return { parameters: {}, booleanOperations: {} }; }
interface HistoryState { document: BooleanExtrusionFeatureGraphV0; bytes: number }
interface Prepared {
  candidate: CadEditorFeatureCandidate; options: CadEditorFeatureSessionOptions;
  outputs: OutputConfig[]; historyIndex?: number;
}

/** A separate authored native graph session. All renderer resources belong to the React bridge. */
export function createCadEditorFeatureSession(document: BooleanExtrusionFeatureGraphV0,
  sessionOptions: CadEditorFeatureSessionOptions): CadEditorFeatureSession {
  const initialOptions = options(sessionOptions);
  let accepted = native(() => evaluateBooleanExtrusionFeatureGraph(document, initialOptions.native), 'Initial native graph admission failed.');
  const initial = deriveSingle(accepted, initialOptions);
  let outputConfigs = initial.outputs;
  let currentOptions = viewOptions(accepted, outputConfigs);
  let displays = initial.displays;
  let display = displays[0];
  let generation = 0;
  let displayGeneration = 0;
  let selectedFeatureId: string | null = null;
  let pending = emptyPending();
  let prepared: Prepared | null = null;
  let history: HistoryState[] = [{ document: copy(accepted.document), bytes: fileBudget(serialize(accepted)) }];
  let historyIndex = 0;
  let dirty = true;
  let downloadStatus: CadEditorFeatureSnapshot['downloadStatus'] = 'Not downloaded';
  let download: { token: string; generation: number } | null = null;
  let disposed = false;
  const sessionId = ++sessionSequence;
  let tokenSequence = 0;
  const listeners = new Set<() => void>();
  const live = () => check(!disposed, 'LIFECYCLE', 'The feature session is disposed.');
  const emit = () => {
    for (const listener of [...listeners]) {
      // Subscriber failures cannot turn an accepted native transaction into a refusal.
      try { listener(); } catch { /* The subscriber owns its error. */ }
    }
  };
  const newToken = () => `cad-editor-feature-${sessionId}-${++tokenSequence}`;
  const historyBytes = () => history.reduce((total, state) => total + state.bytes, 0);
  const hasDraft = () => Object.keys(pending.parameters).length > 0 || Object.keys(pending.booleanOperations).length > 0;
  const requireResolvedDraft = () => check(!hasDraft(), 'INPUT', 'Apply or discard the feature draft first.', { documentId: accepted.document.id, field: 'feature-draft' });
  const snapshot = (): CadEditorFeatureSnapshot => copy({ mode: 'boolean-extrusion', accepted, display, displays, generation, displayGeneration, selectedFeatureId,
    pending, candidate: prepared?.candidate ?? null,
    history: { index: historyIndex, count: history.length, bytes: historyBytes(), canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1 },
    dirty, downloadStatus, disposed });
  const prepare = (kind: CadEditorFeatureCandidate['kind'], result: BooleanExtrusionFeatureGraphResult,
    targetIndex?: number, admittedDisplay?: DerivedOutputs): CadEditorFeatureCandidate => {
    const derived = admittedDisplay ?? deriveCurrent(result, outputConfigs);
    prepared = { candidate: { token: newToken(), baseGeneration: generation, baseDisplayGeneration: displayGeneration,
      kind, result, display: derived.displays[0], displays: derived.displays },
      options: viewOptions(result, derived.outputs), outputs: derived.outputs, historyIndex: targetIndex };
    const returned = copy(prepared.candidate); emit(); return returned;
  };
  const restore = (direction: -1 | 1): CadEditorFeatureCandidate => {
    live(); requireResolvedDraft();
    const targetIndex = historyIndex + direction;
    check(targetIndex >= 0 && targetIndex < history.length, 'INPUT', 'This feature history direction is unavailable.');
    const document = copy(history[targetIndex].document);
    document.revision = nextRevision(accepted.document.revision);
    const result = native(() => evaluateBooleanExtrusionFeatureGraph(document, currentOptions.native),
      'Native feature history reconstruction failed.', { documentId: document.id, field: 'feature-history' });
    return prepare(direction < 0 ? 'undo' : 'redo', result, targetIndex);
  };
  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      live(); check(typeof listener === 'function', 'INPUT', 'A subscription listener is required.');
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    selectFeature(featureId) {
      live(); check(typeof featureId === 'string' && accepted.document.features.some(feature => feature.id === featureId),
        'INPUT', 'Select an existing authored feature.', { documentId: accepted.document.id, bodyId: featureId, field: 'feature-selection' });
      if (selectedFeatureId === featureId) return;
      requireResolvedDraft(); selectedFeatureId = featureId; prepared = null; emit();
    },
    stageLengthParameter(parameterId, draft) {
      live(); check(typeof parameterId === 'string' && accepted.document.parameters.some(parameter => parameter.id === parameterId && parameter.type === 'length'),
        'INPUT', 'Choose an existing length parameter.', { documentId: accepted.document.id, field: 'feature-parameter' });
      check(draft !== null && typeof draft === 'object', 'INPUT', 'An authored length draft is required.', { field: 'feature-parameter' });
      const kindDescriptor = Object.getOwnPropertyDescriptor(draft, 'kind');
      const kind = kindDescriptor && 'value' in kindDescriptor ? kindDescriptor.value : undefined;
      check(kind === 'literal' || kind === 'offset', 'INPUT', 'Choose a literal or parameter offset definition.', { field: 'feature-parameter' });
      const own = record(draft, kind === 'literal' ? ['kind', 'rawValueMM'] : ['kind', 'parameterId', 'rawOffsetMM'], 'feature-parameter');
      const raw = kind === 'literal' ? own.rawValueMM : own.rawOffsetMM;
      check(typeof raw === 'string' && raw.length <= 128, 'BUDGET', 'Length input must have at most 128 characters.', { field: 'feature-parameter' });
      if (kind === 'offset') check(typeof own.parameterId === 'string' && own.parameterId.length <= 128,
        'BUDGET', 'The parameter reference must have at most 128 characters.', { field: 'feature-parameter' });
      const adopted: CadEditorFeatureParameterDraft = kind === 'literal' ? { kind, rawValueMM: raw }
        : { kind, parameterId: own.parameterId as string, rawOffsetMM: raw };
      pending = { ...pending, parameters: { ...pending.parameters, [parameterId]: adopted } }; prepared = null; emit();
    },
    stageBooleanOperation(featureId, operation) {
      live(); check(typeof featureId === 'string' && accepted.document.features.some(feature => feature.id === featureId && feature.kind === 'coplanar-boolean'),
        'INPUT', 'Choose the existing coplanar Boolean feature.', { documentId: accepted.document.id, bodyId: featureId, field: 'feature-operation' });
      check(operation === 'union' || operation === 'intersection' || operation === 'difference', 'INPUT', 'Choose Union, Intersection or Difference.', { field: 'feature-operation' });
      pending = { ...pending, booleanOperations: { ...pending.booleanOperations, [featureId]: operation } }; prepared = null; emit();
    },
    discardPending() { live(); pending = emptyPending(); prepared = null; emit(); },
    prepareApply() {
      live();
      if (!hasDraft()) { prepared = null; emit(); return null; }
      const parameterEdits = Object.entries(pending.parameters).map(([parameterId, draft]) => {
        const context = { documentId: accepted.document.id, field: 'parameter:' + parameterId };
        const definition: BooleanExtrusionLengthDefinition = draft.kind === 'literal'
          ? { kind: 'literal', valueMM: parseScalar(draft.rawValueMM, context) }
          : { kind: 'offset', parameterId: draft.parameterId, offsetMM: parseScalar(draft.rawOffsetMM, context) };
        return { parameterId, definition };
      });
      const booleanEdits = Object.entries(pending.booleanOperations).map(([featureId, operation]) => ({ featureId, operation }));
      const noOp = parameterEdits.every(edit => same(accepted.document.parameters.find(parameter => parameter.id === edit.parameterId)!.definition, edit.definition))
        && booleanEdits.every(edit => { const feature = accepted.document.features.find(feature => feature.id === edit.featureId)!;
          return feature.kind === 'coplanar-boolean' && feature.options.operation === edit.operation; });
      if (noOp) {
        native(() => validateBooleanExtrusionFeatureGraph(accepted), 'Native unchanged graph validation failed.', { documentId: accepted.document.id });
        pending = emptyPending(); prepared = null; emit(); return null;
      }
      const edits: BooleanExtrusionFeatureGraphEdits = { expectedRevision: accepted.document.revision, revision: nextRevision(accepted.document.revision),
        parameterEdits, faceEdits: [], booleanEdits, distanceEdits: [] };
      const result = native(() => updateBooleanExtrusionFeatureGraph(accepted, edits), 'Native feature graph update failed.',
        { documentId: accepted.document.id, field: 'feature-update' });
      return prepare('apply', result);
    },
    prepareOpen(text, inputOptions) {
      live(); fileBudget(text);
      const incomingOptions = inputOptions === undefined ? currentOptions : options(inputOptions);
      const result = native(() => parseBooleanExtrusionFeatureGraph(text, incomingOptions.native), 'Native graph Open failed.', { field: 'feature-file' });
      const incomingDisplay = deriveSingle(result, incomingOptions);
      requireResolvedDraft();
      return prepare('open', result, undefined, incomingDisplay);
    },
    prepareDisplayOutputs(outputs) {
      live();
      check(prepared === null, 'INPUT', 'Resolve the current feature candidate first.',
        { documentId: accepted.document.id, field: 'feature-outputs' });
      const derived = deriveOutputs(accepted, outputs);
      return prepare('display', accepted, undefined, derived);
    },
    prepareExtrusionTransaction(request, postDisplayOutputs) {
      live(); requireResolvedDraft();
      check(prepared === null, 'INPUT', 'Resolve the current feature candidate first.',
        { documentId: accepted.document.id, field: 'extrusion-transaction' });
      const ownedRequest = extrusionRequest(copyRequest(request), accepted);
      const ownedPostOutputs = postDisplayOutputs === undefined ? undefined : copyRequest(postDisplayOutputs);
      const result = native(() => transactBooleanExtrusionFeatureGraphFeatures(accepted, ownedRequest), 'Native extrusion transaction failed.',
        { documentId: accepted.document.id, field: 'extrusion-transaction' });
      const derived = ownedPostOutputs === undefined ? deriveCurrent(result, outputConfigs) : deriveOutputs(result, ownedPostOutputs);
      return prepare('extrusion', result, undefined, derived);
    },
    prepareParameterTransaction(request) {
      live(); requireResolvedDraft();
      check(prepared === null, 'INPUT', 'Resolve the current feature candidate first.',
        { documentId: accepted.document.id, field: 'parameter-transaction' });
      const ownedRequest = record(copyRequest(request, 'parameter-transaction'),
        ['expectedRevision', 'revision', 'parameterOperations', 'distanceEdits'], 'parameter-transaction') as unknown as BooleanExtrusionParameterTransaction;
      const result = native(() => transactBooleanExtrusionFeatureGraphParameters(accepted, ownedRequest), 'Native parameter transaction failed.',
        { documentId: accepted.document.id, field: 'parameter-transaction' });
      return prepare('parameter', result);
    },
    prepareUndo() { return restore(-1); },
    prepareRedo() { return restore(1); },
    acceptCandidate(token) {
      live(); check(prepared !== null && prepared.candidate.token === token && prepared.candidate.baseGeneration === generation
        && prepared.candidate.baseDisplayGeneration === displayGeneration,
        'STALE', 'The prepared feature candidate is no longer current.');
      const current = prepared, result = current.candidate.result;
      if (current.candidate.kind === 'display') {
        displays = current.candidate.displays; display = displays[0]; outputConfigs = current.outputs; currentOptions = current.options;
        displayGeneration++; prepared = null;
        const returned = snapshot(); emit(); return returned;
      }
      const state: HistoryState = { document: copy(result.document), bytes: fileBudget(serialize(result)) };
      if (current.candidate.kind === 'open') { history = [state]; historyIndex = 0; selectedFeatureId = null; }
      else if (current.candidate.kind === 'apply' || current.candidate.kind === 'extrusion' || current.candidate.kind === 'parameter') {
        history = [...history.slice(0, historyIndex + 1), state];
        while (history.length > HISTORY_LIMIT || historyBytes() > HISTORY_BYTES) history.shift();
        historyIndex = history.length - 1;
      } else historyIndex = current.historyIndex!;
      const outputSetChanged = !same(outputConfigs, current.outputs);
      accepted = result; displays = current.candidate.displays; display = displays[0]; outputConfigs = current.outputs; currentOptions = current.options;
      if (current.candidate.kind === 'open' || current.candidate.kind === 'extrusion' && outputSetChanged) displayGeneration++;
      if (selectedFeatureId !== null && !result.document.features.some(feature => feature.id === selectedFeatureId)) selectedFeatureId = null;
      generation++; pending = emptyPending(); prepared = null; download = null;
      dirty = current.candidate.kind !== 'open'; downloadStatus = 'Not downloaded';
      const returned = snapshot(); emit(); return returned;
    },
    cancelCandidate(token) {
      live(); check(prepared !== null && prepared.candidate.token === token, 'STALE', 'The prepared feature candidate is no longer current.');
      prepared = null; emit();
    },
    serializeAccepted() {
      live(); const text = serialize(accepted), token = newToken();
      download = { token, generation };
      return { token, text, suggestedFilename: accepted.document.id + '.boolean-extrusion.graph.json' };
    },
    markDownloaded(token) {
      live(); check(download !== null && download.token === token && download.generation === generation,
        'STALE', 'The accepted graph changed after the download capture.');
      dirty = false; downloadStatus = 'Download started'; emit();
    },
    dispose() {
      if (disposed) return;
      disposed = true; prepared = null; download = null; pending = emptyPending(); emit(); listeners.clear();
    },
  };
}
