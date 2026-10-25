import type { StudioDoc } from '../engine/doc';
import { canonical, fnv64 } from '../util/revision';
import { gravityExperimentBinding, gravityExperimentInput, type GravityExperimentOptions } from './experimentInput';
import { refuse } from './refusal';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonRecord = { [key: string]: Json };

/** A past calculation's JSON envelope. The archived report is not a validated current producer result. */
export type GravityExperimentRecordData = {
  format: 'barocss-gravity-experiment-record';
  schema: 1;
  report: unknown;
};

/** Only this subset is validated for display; it does not certify the archived calculation. */
export type GravityExperimentRecordPreview = {
  joint: string;
  occurrence: string;
  angle: number;
  gravity: [number, number, number];
  torque: number;
  axis: { point: [number, number, number]; direction: [number, number, number] };
  coordinateFrame: string;
  assumptions: string[];
};

function fail(message: string): never { throw refuse('VALUE', `Gravity experiment record: ${message}`); }

function plain(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${label} must be a plain record.`);
  return value as Record<string, unknown>;
}

/** Copy data properties only. In particular, never call an input getter or toJSON method. */
function jsonCopy(value: unknown, active = new Set<object>()): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('numbers must be finite.');
    return value;
  }
  if (typeof value !== 'object') fail('only finite JSON data is accepted.');
  if (active.has(value)) fail('cyclic data is not accepted.');
  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) fail('array subclasses are not accepted.');
      const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
      if (keys.some(key => typeof key !== 'string' || (key !== 'length'
        && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)))) fail('arrays must contain only their dense indexed elements.');
      const out: Json[] = [];
      for (let i = 0; i < value.length; i++) {
        const descriptor = descriptors[String(i)];
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.value === undefined) fail('arrays must be dense JSON data without accessors.');
        out.push(jsonCopy(descriptor.value, active));
      }
      return out;
    }
    plain(value, 'JSON data');
    const entries: [string, Json][] = [];
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') fail('symbol properties are not accepted.');
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!Object.hasOwn(descriptor, 'value')) fail('accessor properties are not accepted.');
      if (descriptor.value !== undefined) entries.push([key, jsonCopy(descriptor.value, active)]);
    }
    return Object.fromEntries(entries);
  } finally { active.delete(value); }
}

function record(value: Json, label: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be a record.`);
  return value;
}
function own(value: JsonRecord, key: string): Json {
  if (!Object.hasOwn(value, key)) fail(`${key} is required as an own property.`);
  return value[key];
}
function string(value: Json, label: string): string {
  if (typeof value !== 'string') fail(`${label} must be a string.`);
  return value;
}
function named(value: Json, label: string): string {
  const text = string(value, label);
  if (!text.trim()) fail(`${label} must not be empty.`);
  return text;
}
function number(value: Json, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be finite.`);
  return value;
}
function tuple(value: Json, label: string): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) fail(`${label} must contain three finite numbers.`);
  return [number(value[0], label), number(value[1], label), number(value[2], label)];
}
function exact(value: JsonRecord, keys: readonly string[], label: string): void {
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail(`${label} has unexpected or missing fields.`);
}
function parsed(text: string, label: string): Json {
  let value: unknown;
  try { value = JSON.parse(text); } catch { fail(`${label} must be JSON.`); }
  return jsonCopy(value);
}

function validate(report: JsonRecord): GravityExperimentRecordPreview {
  if (own(report, 'profile') !== 'static-gravity-v1') fail('unsupported calculation profile.');
  const units = record(own(report, 'units'), 'units');
  const expectedUnits = { angle: 'degree', length: 'mm', mass: 'g', inertia: 'g·mm²', gravity: 'mm/s²', torque: 'N·mm' };
  exact(units, Object.keys(expectedUnits), 'units');
  for (const [key, unit] of Object.entries(expectedUnits)) if (units[key] !== unit) fail(`unsupported ${key} unit.`);

  const binding = record(own(report, 'binding'), 'binding');
  const document = string(own(binding, 'document'), 'binding.document');
  const revision = string(own(binding, 'revision'), 'binding.revision');
  const boundInputs = string(own(binding, 'inputs'), 'binding.inputs');
  const boundDocument = record(parsed(document, 'binding.document'), 'binding.document');
  if (canonical(boundDocument) !== document || fnv64(document) !== revision) fail('document binding is inconsistent.');
  const inputs = record(own(report, 'inputs'), 'inputs');
  const values = record(own(inputs, 'values'), 'values');
  const inputKeys = Object.keys(values);
  if (inputKeys.length !== 1) fail('one explicit joint value is required.');
  const gravity = tuple(own(inputs, 'gravity'), 'gravity');
  const normalized = gravityExperimentInput({ values: Object.fromEntries([[inputKeys[0], number(values[inputKeys[0]], 'angle')]]), gravity });
  if (canonical(inputs) !== canonical(normalized) || boundInputs !== canonical(normalized)) fail('input binding is inconsistent.');

  const scope = record(own(report, 'scope'), 'scope');
  const joint = named(own(scope, 'joint'), 'scope.joint');
  if (joint !== inputKeys[0]) fail('scope joint does not match the explicit input.');
  const occurrence = named(own(scope, 'occurrence'), 'scope.occurrence');
  const coordinateFrame = named(own(scope, 'coordinateFrame'), 'scope.coordinateFrame');
  const axis = record(own(scope, 'axis'), 'scope.axis');
  const point = tuple(own(axis, 'point'), 'axis.point'), direction = tuple(own(axis, 'direction'), 'axis.direction');
  if (!direction.some(value => value !== 0)) fail('axis.direction must not be zero.');
  const assumptions = own(report, 'assumptions');
  if (!Array.isArray(assumptions)) fail('assumptions must be a dense string array.');
  const texts = assumptions.map(value => string(value, 'assumption'));

  const result = record(own(report, 'result'), 'result');
  if (Object.hasOwn(result, 'notReady')) fail('an incomplete result cannot be archived as a completed calculation.');
  const torques = record(own(result, 'torques'), 'torques');
  const generalized = record(own(result, 'generalized'), 'generalized');
  const resultUnits = record(own(result, 'units'), 'result.units');
  exact(torques, [joint], 'torques'); exact(generalized, [joint], 'generalized'); exact(resultUnits, [joint], 'result.units');
  const torque = number(torques[joint], 'torque');
  number(generalized[joint], 'generalized torque'); number(own(result, 'gravity'), 'result.gravity');
  if (resultUnits[joint] !== 'N·mm') fail('result torque unit must be N·mm.');
  // Retain the finite JSON record, without claiming the complete inertia schema was validated.
  record(own(report, 'inertia'), 'inertia');
  return { joint, occurrence, angle: normalized.values[joint], gravity: normalized.gravity, torque,
    axis: { point, direction }, coordinateFrame, assumptions: texts };
}

/** An imported past record: consistency and staleness checks, without evaluation or authenticity claims. */
export class GravityExperimentRecord {
  readonly #report: JsonRecord;
  readonly #preview: GravityExperimentRecordPreview;
  constructor(value: unknown) {
    const raw = plain(value, 'envelope'), keys = Reflect.ownKeys(raw);
    if (keys.length !== 3 || !['format', 'schema', 'report'].every(key => Object.hasOwn(raw, key))) fail('envelope must contain exactly format, schema and report.');
    const envelope = record(jsonCopy(raw), 'envelope');
    if (own(envelope, 'format') !== 'barocss-gravity-experiment-record' || own(envelope, 'schema') !== 1) fail('unsupported format or schema.');
    this.#report = record(own(envelope, 'report'), 'report');
    this.#preview = validate(this.#report);
  }
  static parse(text: string): GravityExperimentRecord {
    if (typeof text !== 'string') fail('serialized record must be a string.');
    return new GravityExperimentRecord(parsed(text, 'serialized record'));
  }
  toJSON(): GravityExperimentRecordData {
    return { format: 'barocss-gravity-experiment-record', schema: 1, report: jsonCopy(this.#report) };
  }
  get report(): unknown { return jsonCopy(this.#report); }
  get preview(): GravityExperimentRecordPreview { return structuredClone(this.#preview); }
  /** Full equality only; this does not test current producer code or material catalogue compatibility. */
  matches(doc: StudioDoc, options: GravityExperimentOptions): boolean {
    const binding = gravityExperimentBinding(doc, gravityExperimentInput(options)), previous = record(own(this.#report, 'binding'), 'binding');
    return binding.document === previous.document && binding.inputs === previous.inputs;
  }
}
