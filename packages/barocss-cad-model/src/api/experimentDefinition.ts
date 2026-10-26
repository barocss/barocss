import type { StudioDoc } from '../engine/doc';
import { canonical, fnv64 } from '../util/revision';
import { GravityExperiment } from './experiment';
import { gravityExperimentBinding, gravityExperimentInput, type GravityExperimentOptions } from './experimentInput';
import { refuse } from './refusal';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonRecord = { [key: string]: Json };
type DefinitionData = {
  format: 'barocss-gravity-experiment-definition';
  schema: 1;
  profile: 'static-gravity-v1';
  units: { angle: 'degree'; gravity: 'mm/s²' };
  binding: { document: string; revision: string; inputs: string };
  inputs: ReturnType<typeof gravityExperimentInput>;
};

function fail(message: string): never { throw refuse('VALUE', `Gravity experiment definition: ${message}`); }

/** Copy data descriptors only: no user getter, toJSON method or prototype instance is executed. */
function jsonCopy(value: unknown, active = new Set<object>(), omitUndefinedProperties = false): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('numbers must be finite.');
    return value;
  }
  if (typeof value !== 'object') fail('only finite JSON data is accepted.');
  if (active.has(value)) fail('cyclic data is not accepted.');
  active.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) fail('array subclasses are not accepted.');
      if (keys.some(key => typeof key !== 'string' || (key !== 'length'
        && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)))) fail('arrays must contain only dense indexed elements.');
      const result: Json[] = [];
      for (let i = 0; i < value.length; i++) {
        const descriptor = descriptors[String(i)];
        if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('arrays must be dense data without accessors.');
        result.push(jsonCopy(descriptor.value, active, omitUndefinedProperties));
      }
      return result;
    }
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('objects must be plain records.');
    const entries: [string, Json][] = [];
    for (const key of keys) {
      if (typeof key !== 'string') fail('symbol properties are not accepted.');
      const descriptor = descriptors[key];
      if (!Object.hasOwn(descriptor, 'value')) fail('accessor properties are not accepted.');
      if (omitUndefinedProperties && descriptor.value === undefined) continue;
      entries.push([key, jsonCopy(descriptor.value, active, omitUndefinedProperties)]);
    }
    return Object.fromEntries(entries);
  } finally { active.delete(value); }
}

function record(value: Json, label: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be a record.`);
  return value;
}
function exact(value: JsonRecord, keys: readonly string[], label: string): void {
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail(`${label} has unexpected or missing fields.`);
}
function text(value: Json, label: string): string {
  if (typeof value !== 'string') fail(`${label} must be a string.`);
  return value;
}
function finite(value: Json, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be finite.`);
  return value;
}
function parsed(value: string): Json {
  let data: unknown;
  try { data = JSON.parse(value); } catch { fail('serialized data must be JSON.'); }
  return jsonCopy(data);
}
function inputsOf(value: Json): ReturnType<typeof gravityExperimentInput> {
  const input = record(value, 'inputs');
  exact(input, ['values', 'gravity'], 'inputs');
  const values = record(input.values, 'values'), keys = Object.keys(values);
  if (keys.length !== 1) fail('exactly one explicit joint value is required.');
  const gravity = input.gravity;
  if (!Array.isArray(gravity) || gravity.length !== 3) fail('gravity must contain three finite numbers.');
  return gravityExperimentInput({ values: Object.fromEntries([[keys[0], finite(values[keys[0]], 'angle')]]),
    gravity: [finite(gravity[0], 'gravity'), finite(gravity[1], 'gravity'), finite(gravity[2], 'gravity')] });
}

/** Saved explicit inputs, not a calculation result or a material/producer authenticity certificate. */
export class GravityExperimentDefinition {
  readonly #data: DefinitionData;
  constructor(value: unknown) {
    const data = record(jsonCopy(value), 'envelope');
    exact(data, ['format', 'schema', 'profile', 'units', 'binding', 'inputs'], 'envelope');
    if (data.format !== 'barocss-gravity-experiment-definition' || data.schema !== 1 || data.profile !== 'static-gravity-v1') fail('unsupported format, schema or profile.');
    const units = record(data.units, 'units'); exact(units, ['angle', 'gravity'], 'units');
    if (units.angle !== 'degree' || units.gravity !== 'mm/s²') fail('unsupported input units.');
    const bound = record(data.binding, 'binding'); exact(bound, ['document', 'revision', 'inputs'], 'binding');
    const document = text(bound.document, 'binding.document'), revision = text(bound.revision, 'binding.revision');
    const inputText = text(bound.inputs, 'binding.inputs'), inputs = inputsOf(data.inputs);
    const documentData = record(parsed(document), 'binding.document');
    if (canonical(documentData) !== document || fnv64(document) !== revision || canonical(inputs) !== inputText) fail('binding is inconsistent.');
    this.#data = { format: 'barocss-gravity-experiment-definition', schema: 1, profile: 'static-gravity-v1',
      units: { angle: 'degree', gravity: 'mm/s²' }, binding: { document, revision, inputs: inputText }, inputs };
  }
  static create(doc: StudioDoc, options: GravityExperimentOptions): GravityExperimentDefinition {
    // Current documents follow canonical's undefined-property omission; saved settings remain strict.
    record(jsonCopy(doc, new Set<object>(), true), 'document');
    const inputs = inputsOf(jsonCopy(options));
    return new GravityExperimentDefinition({ format: 'barocss-gravity-experiment-definition', schema: 1,
      profile: 'static-gravity-v1', units: { angle: 'degree', gravity: 'mm/s²' },
      binding: gravityExperimentBinding(doc, inputs), inputs });
  }
  static parse(value: string): GravityExperimentDefinition {
    if (typeof value !== 'string') fail('serialized definition must be a string.');
    return new GravityExperimentDefinition(parsed(value));
  }
  toJSON(): DefinitionData { return structuredClone(this.#data); }
  get options(): GravityExperimentOptions { return structuredClone(this.#data.inputs); }
  /** Equality to saved document/inputs only, not execution readiness or current producer compatibility. */
  matches(doc: StudioDoc): boolean {
    record(jsonCopy(doc, new Set<object>(), true), 'document');
    const binding = gravityExperimentBinding(doc, this.#data.inputs);
    return binding.document === this.#data.binding.document && binding.inputs === this.#data.binding.inputs;
  }
  run(doc: StudioDoc): GravityExperiment {
    if (!this.matches(doc)) fail('the current document differs; explicitly rebind before running.');
    return new GravityExperiment(doc, this.options);
  }
  rebind(doc: StudioDoc): GravityExperimentDefinition { return GravityExperimentDefinition.create(doc, this.options); }
}
