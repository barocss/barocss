import { evaluateBooleanExtrusionFeatureGraph, validateBooleanExtrusionFeatureGraph,
  BooleanExtrusionFeatureGraphError, BooleanExtrusionFeatureGraphDiagnosticCode } from './boolean-extrusion-feature-graph.js';
import type { BooleanExtrusionFeatureGraphResult, BooleanExtrusionLengthParameter, BooleanExtrusionLengthDefinition } from './boolean-extrusion-feature-graph.js';
import { admitParameter, definition } from './circle-graph-internal.js';
import { copyCadData } from './data-copy.js';

export type BooleanExtrusionParameterOperation = { kind: 'upsert'; parameter: BooleanExtrusionLengthParameter } | { kind: 'remove'; parameterId: string };
export interface BooleanExtrusionParameterTransaction {
  expectedRevision: number; revision: number; parameterOperations: BooleanExtrusionParameterOperation[];
  distanceEdits: { featureId: string; definition: BooleanExtrusionLengthDefinition }[];
}

const CODE = BooleanExtrusionFeatureGraphDiagnosticCode, LABEL = 'Boolean extrusion parameter lifecycle native length';
type Context = { path?: string; featureId?: string | null; parameterId?: string | null; cause?: unknown };
function check(condition: boolean, code: BooleanExtrusionFeatureGraphDiagnosticCode, detail: string, context: Context = {}): asserts condition {
  if (!condition) throw new BooleanExtrusionFeatureGraphError(code, detail, context);
}
/** Independent authored/owned budgets; copy every occurrence and refuse ancestor cycles. */
function snapshot(input: unknown, owned: boolean, root: string): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = owned ? 1048576 : 16384;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 40 : 12), code, 'own-value/depth budget exceeded', { path });
    if (value === null && owned || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required', { path }); return value; }
    if (typeof value === 'string') { check(value.length <= (owned ? 262144 : 128), code, 'bounded own/source string required', { path }); return value; }
    check(value !== null && typeof value === 'object', code, 'plain own data required', { path });
    check(!ancestors.has(value), code, 'ancestor cycles refused', { path });
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused', { path });
    check(keys.length <= (array ? (owned ? 8193 : 65) : (owned ? 64 : 16)) && keys.every(key => typeof key === 'string' && key.length <= 128
      && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden/excess own fields refused', { path });
    ancestors.add(value);
    try {
      if (array) {
        const length = descriptors.length.value as number;
        check(Number.isInteger(length) && length >= 0 && length <= (owned ? 8192 : 64) && keys.length === length + 1, code, 'dense bounded own array required', { path });
        return Array.from({ length }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), code, 'sparse/foreign own array field refused', { path });
          return copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']'); });
      }
      return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
    } finally { ancestors.delete(value); }
  }; return copy(input, 0, root);
}
function record(input: unknown, fields: string[], context: Context): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), CODE.INPUT, 'own record required', context);
  const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), CODE.INPUT, 'exact fields required: ' + fields.join(','), context); return data;
}
function id(value: unknown, context: Context): string {
  check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..48 required', context); return value;
}
function revision(value: unknown, path: string): number {
  check(typeof value === 'number' && Number.isInteger(value) && !Object.is(value, -0) && value >= 0 && value <= 1000000000,
    CODE.REVISION, 'unsigned stable revision0..1000000000 required', { path }); return value;
}
function helper<T>(action: () => T, detail: string, context: Context): T {
  try { return action(); } catch (cause) {
    if (cause instanceof BooleanExtrusionFeatureGraphError) throw cause;
    throw new BooleanExtrusionFeatureGraphError(CODE.PARAMETER, detail, { ...context, cause });
  }
}
function admitDefinition(input: unknown, context: Context): BooleanExtrusionLengthDefinition {
  const admitted = helper(() => definition(input, LABEL, context.path ?? '$'), 'actual original typed length definition admission refused', context);
  if (admitted.kind === 'offset') id(admitted.parameterId, { ...context, path: context.path + '.parameterId' }); return admitted;
}
/** All names stay reserved for this transaction, including removed parameters and native/source names. */
function startingIdentities(previous: BooleanExtrusionFeatureGraphResult): Set<string> {
  const reserved = new Set<string>(), collect = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && (key === 'id' || key.endsWith('Id') || key === 'name')) reserved.add(item);
      else if (key.endsWith('Ids') && Array.isArray(item)) for (const id of item) { if (typeof id === 'string') reserved.add(id); }
      else collect(item);
    }
  }; collect(previous); return reserved;
}

/** One complete prior validation and one final native evaluation; no per-operation geometry staging. */
export function transactBooleanExtrusionFeatureGraphParameters(previousInput: BooleanExtrusionFeatureGraphResult,
  transactionInput: BooleanExtrusionParameterTransaction): BooleanExtrusionFeatureGraphResult {
  // Snapshot separately BEFORE either native validation or authored candidate mutation.
  const previous = snapshot(previousInput, true, '$previous') as BooleanExtrusionFeatureGraphResult;
  const copiedTransaction = snapshot(transactionInput, false, '$transaction');
  validateBooleanExtrusionFeatureGraph(previous);
  const data = record(copiedTransaction, ['expectedRevision', 'revision', 'parameterOperations', 'distanceEdits'], { path: '$transaction' });
  const expectedRevision = revision(data.expectedRevision, '$transaction.expectedRevision'), nextRevision = revision(data.revision, '$transaction.revision');
  check(expectedRevision === previous.document.revision && nextRevision === previous.document.revision + 1, CODE.REVISION,
    'expected starting revision and exact starting+1 revision required', { path: '$transaction.revision' });
  const parameterInputs = data.parameterOperations, distanceInputs = data.distanceEdits;
  check(Array.isArray(parameterInputs) && parameterInputs.length >= 1 && parameterInputs.length <= 16, CODE.BUDGET,
    'required1..16 parameter operations', { path: '$transaction.parameterOperations' });
  check(Array.isArray(distanceInputs) && distanceInputs.length <= 1, CODE.BUDGET, 'explicit0..1 distance edits required', { path: '$transaction.distanceEdits' });
  const starting = new Map(previous.document.parameters.map(parameter => [parameter.id, parameter])), reserved = startingIdentities(previous), targets = new Set<string>();
  const operations: BooleanExtrusionParameterOperation[] = parameterInputs.map((input, index) => {
    const path = '$transaction.parameterOperations[' + index + ']';
    check(input !== null && typeof input === 'object' && !Array.isArray(input), CODE.INPUT, 'parameter operation record required', { path });
    const kind = (input as Record<string, unknown>).kind;
    check(kind === 'upsert' || kind === 'remove', CODE.INPUT, 'explicit upsert/remove parameter operation required', { path: path + '.kind' });
    const operation = record(input, kind === 'upsert' ? ['kind', 'parameter'] : ['kind', 'parameterId'], { path });
    let parameter: BooleanExtrusionLengthParameter | null = null;
    const parameterId = kind === 'upsert'
      ? id(record(operation.parameter, ['id', 'type', 'definition'], { path: path + '.parameter' }).id, { path: path + '.parameter.id' })
      : id(operation.parameterId, { path: path + '.parameterId' });
    const context = { path, parameterId };
    check(!targets.has(parameterId), CODE.INPUT, 'parameter target must appear once across all operation kinds; remove/recreate is forbidden', context); targets.add(parameterId);
    if (kind === 'upsert') {
      parameter = helper(() => admitParameter(operation.parameter, LABEL, path + '.parameter'), 'actual original typed parameter admission refused', context);
      id(parameter.id, context); if (parameter.definition.kind === 'offset') id(parameter.definition.parameterId, context);
      const existing = starting.get(parameterId);
      if (existing) check(parameter.id === existing.id && parameter.type === existing.type, CODE.IDENTITY, 'existing parameter ID/type must remain', context);
      else { check(!reserved.has(parameterId), CODE.IDENTITY, 'new parameter must be distinct from every starting logical/native/source identity and prior new target', context); reserved.add(parameterId); }
      return { kind, parameter };
    }
    check(starting.has(parameterId), CODE.PARAMETER, 'removal must target an existing STARTING parameter only', context);
    return { kind, parameterId };
  });
  const distanceEdits = distanceInputs.map((input, index) => {
    const path = '$transaction.distanceEdits[' + index + ']', edit = record(input, ['featureId', 'definition'], { path });
    const featureId = id(edit.featureId, { path: path + '.featureId' }), feature = previous.document.features.find(feature => feature.id === featureId);
    check(feature !== undefined && feature.kind === 'normal-extrusion', CODE.DEPENDENCY, 'distance edit must target the actual STARTING extrusion feature', { path, featureId });
    return { featureId, definition: admitDefinition(edit.definition, { path: path + '.definition', featureId }) };
  });
  // All operation kinds/targets/definitions/identity checks are complete before staging.
  const candidate = copyCadData(previous.document); candidate.revision = nextRevision;
  for (const operation of operations) {
    const parameterId = operation.kind === 'upsert' ? operation.parameter.id : operation.parameterId;
    const slot = candidate.parameters.findIndex(parameter => parameter.id === parameterId);
    if (operation.kind === 'upsert') {
      if (starting.has(parameterId)) {
        check(slot >= 0, CODE.PARAMETER, 'existing parameter author slot must remain until its one declared operation', { path: '$transaction.parameterOperations', parameterId });
        candidate.parameters[slot].definition = copyCadData(operation.parameter.definition);
      } else candidate.parameters.push(copyCadData(operation.parameter));
    } else {
      check(slot >= 0, CODE.PARAMETER, 'starting parameter removal slot must exist', { path: '$transaction.parameterOperations', parameterId });
      candidate.parameters.splice(slot, 1);
    }
    check(candidate.parameters.length <= 16, CODE.BUDGET, 'bounded WORKING parameter table exceeds16', { path: '$transaction.parameterOperations', parameterId });
  }
  for (const edit of distanceEdits) {
    const feature = candidate.features.find(feature => feature.id === edit.featureId);
    check(feature !== undefined && feature.kind === 'normal-extrusion', CODE.DEPENDENCY, 'unchanged candidate extrusion feature required', { path: '$transaction.distanceEdits', featureId: edit.featureId });
    feature.distance = copyCadData(edit.definition);
  }
  check(candidate.parameters.length <= 8, CODE.BUDGET, 'final authored parameter table must remain0..8; temporary WORKING capacity does not widen the graph', { path: '$transaction.parameterOperations' });
  // Public evaluator owns all final dependency/type/offset/native/generated-ID/caller-budget admission.
  return evaluateBooleanExtrusionFeatureGraph(candidate, previous.options);
}
