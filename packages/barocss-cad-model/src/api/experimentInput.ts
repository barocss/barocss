import type { StudioDoc } from '../engine/doc';
import { canonical, fnv64 } from '../util/revision';
import { refuse } from './refusal';

/** Explicit public joint angles in degrees and gravity in mm/s²; no gravity default. */
export type GravityExperimentOptions = {
  values: Readonly<Record<string, number>>;
  gravity: readonly [number, number, number];
};

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw refuse('VALUE', `${label} must be a record.`);
  }
  return value as Record<string, unknown>;
};

/** Validate and detach the explicit inputs. Joint identity and mechanism admission belong to the experiment. */
export function gravityExperimentInput(options: GravityExperimentOptions): {
  values: Record<string, number>;
  gravity: [number, number, number];
} {
  const input = record(options, 'Gravity experiment options');
  if (!Object.hasOwn(input, 'values') || !Object.hasOwn(input, 'gravity')) {
    throw refuse('VALUE', 'A gravity experiment requires its own values and gravity inputs.');
  }
  const values = record(input.values, 'Joint values'), keys = Reflect.ownKeys(values);
  if (keys.length !== 1 || typeof keys[0] !== 'string') {
    throw refuse('VALUE', 'A gravity experiment requires exactly one explicit joint value in degrees.');
  }
  const key = keys[0], value = values[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw refuse('VALUE', 'The explicit joint value must be a finite number of degrees.');
  }
  const gravity = input.gravity;
  if (!Array.isArray(gravity) || gravity.length !== 3) {
    throw refuse('VALUE', 'Gravity must be a dense [x, y, z] of finite numbers in mm/s².');
  }
  const component = (index: number): number => {
    const value: unknown = Object.hasOwn(gravity, index) ? gravity[index] : undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw refuse('VALUE', 'Gravity must be a dense [x, y, z] of finite numbers in mm/s².');
    }
    return value;
  };
  return { values: Object.fromEntries([[key, value]]), gravity: [component(0), component(1), component(2)] };
}

/** Full document/input text is authoritative; the FNV label is for staleness, never cryptographic integrity. */
export function gravityExperimentBinding(doc: StudioDoc, inputs: ReturnType<typeof gravityExperimentInput>): {
  document: string;
  revision: string;
  inputs: string;
} {
  const document = canonical(structuredClone(doc));
  return { document, revision: fnv64(document), inputs: canonical(gravityExperimentInput(inputs)) };
}
