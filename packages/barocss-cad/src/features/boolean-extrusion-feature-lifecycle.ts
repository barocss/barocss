import { evaluateBooleanExtrusionFeatureGraph, validateBooleanExtrusionFeatureGraph,
  BooleanExtrusionFeatureGraphError, BooleanExtrusionFeatureGraphDiagnosticCode } from './boolean-extrusion-feature-graph.js';
import type { BooleanExtrusionFeatureGraphResult, BooleanExtrusionFeatureGraphV0 } from './boolean-extrusion-feature-graph.js';
import { definition } from '../circle-graph-internal.js';
import { copyCadData } from '../data-copy.js';
import { same } from '../core/structural-equality.js';

export type BooleanExtrusionFeatureOperation = { kind: 'upsert'; feature: BooleanExtrusionFeatureGraphV0['features'][number] } | { kind: 'remove'; featureId: string };
export interface BooleanExtrusionFeatureTransaction { expectedRevision: number; revision: number; featureOperations: BooleanExtrusionFeatureOperation[] }

const CODE = BooleanExtrusionFeatureGraphDiagnosticCode;
type Feature = BooleanExtrusionFeatureGraphV0['features'][number];
type Context = { path?: string; featureId?: string | null; parameterId?: string | null; cause?: unknown };
function check(condition: boolean, code: BooleanExtrusionFeatureGraphDiagnosticCode, detail: string, context: Context = {}): asserts condition {
  if (!condition) throw new BooleanExtrusionFeatureGraphError(code, detail, context);
}
/** Independent authored/owned budgets. Each occurrence is copied; only ancestor cycles are refused. */
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
function id(value: unknown, context: Context, maximum = 48): string {
  check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..' + maximum + ' required', context); return value;
}
function revision(value: unknown, path: string): number {
  check(typeof value === 'number' && Number.isInteger(value) && !Object.is(value, -0) && value >= 0 && value <= 1000000000,
    CODE.REVISION, 'unsigned stable revision0..1000000000 required', { path }); return value;
}
function startingIdentities(previous: BooleanExtrusionFeatureGraphResult): Set<string> {
  const reserved = new Set<string>(), collect = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && (key === 'id' || key.endsWith('Id') || key === 'name')) reserved.add(item);
      else if (key.endsWith('Ids') && Array.isArray(item)) for (const value of item) { if (typeof value === 'string') reserved.add(value); }
      else collect(item);
    }
  }; collect(previous); return reserved;
}
/** Authored shape/ID admission only; the final original evaluator owns native profiles and references. */
function admitFeature(input: unknown, path: string): Feature {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), CODE.INPUT, 'authored feature record required', { path });
  const kind = (input as Record<string, unknown>).kind;
  check(kind === 'face-input' || kind === 'coplanar-boolean' || kind === 'normal-extrusion', CODE.INPUT, 'original authored feature kind required', { path: path + '.kind' });
  const fields = kind === 'face-input' ? ['id', 'kind', 'outputSlotId', 'plane', 'loop', 'options'] : kind === 'coplanar-boolean'
    ? ['id', 'kind', 'outputSlotId', 'operandAFeatureId', 'operandBFeatureId', 'options'] : ['id', 'kind', 'outputSlotId', 'regionFeatureId', 'distance', 'options'];
  const f = record(input, fields, { path }), featureId = id(f.id, { path: path + '.id' }), context = { path, featureId };
  id(f.outputSlotId, context);
  if (kind === 'face-input') {
    const plane = record(f.plane, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights'], { ...context, path: path + '.plane' });
    check(plane.kind === 'surface', CODE.INPUT, 'original authored Surface required', context); id(plane.id, context);
    const loop = record(f.loop, ['id', 'edges'], { ...context, path: path + '.loop' }); id(loop.id, context);
    check(Array.isArray(loop.edges), CODE.INPUT, 'ordered original authored Curve array required', context);
    loop.edges.forEach((input, index) => { const curve = record(input, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'], { ...context, path: path + '.loop.edges[' + index + ']' });
      check(curve.kind === 'curve', CODE.INPUT, 'original authored Curve required', context); id(curve.id, context); });
    const options = record(f.options, ['faceId', 'evaluationId', 'resultIdPrefix', 'orientation'], context);
    id(options.faceId, context); id(options.evaluationId, context); id(options.resultIdPrefix, context, 20);
  } else if (kind === 'coplanar-boolean') {
    id(f.operandAFeatureId, context); id(f.operandBFeatureId, context);
    const options = record(f.options, ['operation', 'evaluationId', 'resultIdPrefix', 'maximumPairTests', 'maximumFragments'], context);
    id(options.evaluationId, context); id(options.resultIdPrefix, context, 12);
    check(options.operation === 'union' || options.operation === 'intersection' || options.operation === 'difference', CODE.INPUT, 'original Boolean operation required', context);
  } else {
    id(f.regionFeatureId, context);
    const options = record(f.options, ['evaluationId', 'resultIdPrefix', 'maximumVertices', 'maximumFaces', 'maximumSourceChunks', 'maximumBindingSamples'], context);
    id(options.evaluationId, context); id(options.resultIdPrefix, context, 20);
    try { const distance = definition(f.distance, 'Boolean extrusion feature lifecycle native length', path + '.distance');
      if (distance.kind === 'offset') id(distance.parameterId, { ...context, path: path + '.distance.parameterId' }); f.distance = distance;
    } catch (cause) {
      if (cause instanceof BooleanExtrusionFeatureGraphError) throw cause;
      throw new BooleanExtrusionFeatureGraphError(CODE.PARAMETER, 'actual original distance definition admission refused', { ...context, cause });
    }
  }
  return f as unknown as Feature;
}
function stableExisting(previous: Feature, next: Feature, context: Context): void {
  check(next.id === previous.id && next.kind === previous.kind && next.outputSlotId === previous.outputSlotId, CODE.IDENTITY,
    'existing feature ID/kind/output slot must remain', context);
  if (previous.kind === 'coplanar-boolean' && next.kind === 'coplanar-boolean') {
    const { operation: oldOperation, ...oldOptions } = previous.options, { operation: newOperation, ...newOptions } = next.options;
    void oldOperation; void newOperation;
    check(same(oldOptions, newOptions), CODE.IDENTITY, 'existing Boolean native options stay equal except operation', context);
  } else check(same(previous.options, next.options), CODE.IDENTITY, 'existing native construction options must stay bit-identical', context);
  if (previous.kind === 'face-input' && next.kind === 'face-input') check(next.plane.id === previous.plane.id && next.loop.id === previous.loop.id
    && next.loop.edges.length === previous.loop.edges.length && next.loop.edges.every((curve, i) => curve.id === previous.loop.edges[i].id),
  CODE.IDENTITY, 'existing Face plane/loop/ordered Curve IDs and count must remain', context);
}

/** Atomic explicit feature replacement and dependency repair, retaining the original final four-node authority. */
export function transactBooleanExtrusionFeatureGraphFeatures(previousInput: BooleanExtrusionFeatureGraphResult,
  transactionInput: BooleanExtrusionFeatureTransaction): BooleanExtrusionFeatureGraphResult {
  const previous = snapshot(previousInput, true, '$previous') as BooleanExtrusionFeatureGraphResult;
  const copiedTransaction = snapshot(transactionInput, false, '$transaction');
  validateBooleanExtrusionFeatureGraph(previous);
  const data = record(copiedTransaction, ['expectedRevision', 'revision', 'featureOperations'], { path: '$transaction' });
  const expectedRevision = revision(data.expectedRevision, '$transaction.expectedRevision'), nextRevision = revision(data.revision, '$transaction.revision');
  check(expectedRevision === previous.document.revision && nextRevision === previous.document.revision + 1, CODE.REVISION,
    'expected starting revision and exact starting+1 required', { path: '$transaction.revision' });
  const inputs = data.featureOperations;
  check(Array.isArray(inputs) && inputs.length >= 1 && inputs.length <= 8, CODE.BUDGET, 'explicit1..8 feature operations required', { path: '$transaction.featureOperations' });
  const starting = new Map(previous.document.features.map(feature => [feature.id, feature])), reserved = startingIdentities(previous), targets = new Set<string>();
  const operations: BooleanExtrusionFeatureOperation[] = inputs.map((input, index) => {
    const path = '$transaction.featureOperations[' + index + ']';
    check(input !== null && typeof input === 'object' && !Array.isArray(input), CODE.INPUT, 'feature operation record required', { path });
    const kind = (input as Record<string, unknown>).kind;
    check(kind === 'upsert' || kind === 'remove', CODE.INPUT, 'explicit upsert/remove feature operation required', { path: path + '.kind' });
    const operation = record(input, kind === 'upsert' ? ['kind', 'feature'] : ['kind', 'featureId'], { path });
    const feature = kind === 'upsert' ? admitFeature(operation.feature, path + '.feature') : null;
    const featureId = feature === null ? id(operation.featureId, { path: path + '.featureId' }) : feature.id, context = { path, featureId };
    check(!targets.has(featureId), CODE.INPUT, 'feature target must occur once across operation kinds; remove/recreate forbidden', context); targets.add(featureId);
    const original = starting.get(featureId);
    if (feature !== null) {
      if (original) stableExisting(original, feature, context);
      else {
        check(feature.id !== feature.outputSlotId && !reserved.has(feature.id) && !reserved.has(feature.outputSlotId), CODE.IDENTITY,
          'new logical feature/output slot must be mutually distinct and fresh versus all starting/native/source/earlier new identities', context);
        // Definitions only: forward dependency references are admitted by the final original evaluator.
        reserved.add(feature.id); reserved.add(feature.outputSlotId);
      }
      return { kind: 'upsert', feature };
    }
    check(original !== undefined, CODE.DEPENDENCY, 'removal must target an existing STARTING feature only', context);
    return { kind: 'remove', featureId };
  });
  // Every operation/shape/target/identity guard is complete before authored candidate mutation.
  const candidate = copyCadData(previous.document); candidate.revision = nextRevision;
  for (const operation of operations) {
    const featureId = operation.kind === 'upsert' ? operation.feature.id : operation.featureId, slot = candidate.features.findIndex(feature => feature.id === featureId);
    if (operation.kind === 'upsert') {
      if (starting.has(featureId)) {
        check(slot >= 0, CODE.DEPENDENCY, 'starting authored feature slot must exist for its one operation', { path: '$transaction.featureOperations', featureId });
        candidate.features[slot] = copyCadData(operation.feature);
      } else candidate.features.push(copyCadData(operation.feature));
    } else {
      check(slot >= 0, CODE.DEPENDENCY, 'starting feature removal slot required', { path: '$transaction.featureOperations', featureId }); candidate.features.splice(slot, 1);
    }
    check(candidate.features.length <= 8, CODE.BUDGET, 'bounded WORKING feature table exceeds8', { path: '$transaction.featureOperations', featureId });
  }
  // Final current two-Face/one-Boolean/one-through-four-extrusion profile and references/native profiles/unused lengths/budgets remain original903 admission.
  return evaluateBooleanExtrusionFeatureGraph(candidate, previous.options);
}
