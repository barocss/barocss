/**
 * The kernel's own-data checks, shared (P3): many modules take their input only as plain own data — a bounded,
 * acyclic snapshot of plain objects and dense arrays of finite numbers, booleans, strings and null — and check
 * records for exactly their fields. Each module keeps its own refusal (its error class and codes) and passes it in; the
 * checks, their order and their messages live here once.
 */

export const OWN_VALUE_BUDGET_EXCEEDED = 'Own value/depth budget exceeded';
export const FINITE_OWN_NUMBERS_REQUIRED = 'Finite own numbers are required';
export const FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED = 'Finite represented own numbers are required';
export const OWN_STRING_BUDGET_EXCEEDED = 'Own string budget exceeded';
export const ACYCLIC_OWN_DATA_REQUIRED = 'Acyclic own data is required';
export const PLAIN_OWN_DATA_PROTOTYPES_REQUIRED = 'Plain own-data prototypes are required';
export const BOUNDED_OWN_FIELDS_REQUIRED = 'Bounded fields without getters/symbols/hidden data are required';
export const DENSE_BOUNDED_OWN_ARRAYS_REQUIRED = 'Dense bounded own arrays are required';
export const DENSE_BOUNDED_ARRAYS_REQUIRED = 'Dense bounded arrays are required';
export const SPARSE_ARRAY_FIELDS_REFUSED = 'Sparse/extra array fields are refused';
export const SPARSE_OWN_ARRAY_FIELDS_REFUSED = 'Sparse/extra own array fields are refused';
export const OWN_SNAPSHOT_FAILED = 'Own snapshot failed';
export const OWN_RECORD_REQUIRED = 'An own record is required';
export const EXACT_OWN_FIELDS_REQUIRED = 'Exact own fields are required';
export const OWN_RECORD = 'own record';
export const EXACT_FIELDS_REQUIRED = 'exact fields required: ';

/** Whether a value is an object that is not an array (a record to read fields from). */
export const isOwnRecord = (input: unknown): input is Record<string, unknown> => input !== null && typeof input === 'object' && !Array.isArray(input);
/** Whether a record has exactly these own fields (no more, none missing). */
export const hasExactOwnFields = (data: Record<string, unknown>, fields: readonly string[]): boolean => Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field));

/** A module's refusal and wording for `ownSnapshot`. */
export interface OwnSnapshotSpec<C> {
  /** Codes: bad input, bad data a caller owns (`owned`), and an input past the budgets. */
  readonly input: C; readonly owned: C; readonly budget: C;
  /** Throw the module's refusal. */
  readonly fail: (code: C, detail: string) => never;
  /** Throw the module's refusal for something else thrown while copying (its cause). */
  readonly wrap: (code: C, detail: string, cause: unknown) => never;
  /** Whether something thrown is already the module's refusal (passed on as it is). */
  readonly isRefusal: (e: unknown) => boolean;
  /** The module's wording where modules differ (defaults: the first form of each). */
  readonly finite?: string; readonly dense?: string; readonly sparse?: string;
}
interface CopyState<C> { remaining: number; readonly ancestors: Set<object>; readonly owned: boolean; readonly code: C; readonly spec: OwnSnapshotSpec<C> }

/**
 * A deep copy of plain own data, refused unless it is within budget (1 048 576 values, depth 64, strings of 262 144,
 * 64 fields a record, 8 192 entries an array), acyclic, of plain prototypes, without getters, symbols or hidden fields,
 * with dense arrays and finite numbers. `owned`: the data is the caller's own (every refusal then has the `owned` code).
 */
export function ownSnapshot<C>(input: unknown, owned: boolean, spec: OwnSnapshotSpec<C>): unknown {
  const code = owned ? spec.owned : spec.input, state: CopyState<C> = { remaining: 1048576, ancestors: new Set<object>(), owned, code, spec };
  try { return copyOwn(state, input, 0); } catch (cause) { if (spec.isRefusal(cause)) throw cause; spec.wrap(code, OWN_SNAPSHOT_FAILED, cause); }
}
function copyOwn<C>(st: CopyState<C>, value: unknown, depth: number): unknown {
  const { spec, code } = st;
  if (!(--st.remaining >= 0 && depth <= 64)) spec.fail(st.owned ? spec.owned : spec.budget, OWN_VALUE_BUDGET_EXCEEDED);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) spec.fail(code, spec.finite ?? FINITE_OWN_NUMBERS_REQUIRED); return value; }
  if (typeof value === 'string') { if (!(value.length <= 262144)) spec.fail(st.owned ? spec.owned : spec.budget, OWN_STRING_BUDGET_EXCEEDED); return value; }
  if (!(typeof value === 'object' && !st.ancestors.has(value))) spec.fail(code, ACYCLIC_OWN_DATA_REQUIRED);
  const object = value as object, array = Array.isArray(object), prototype = Object.getPrototypeOf(object), keys = Reflect.ownKeys(object), descriptors = Object.getOwnPropertyDescriptors(object);
  if (!(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null)) spec.fail(code, PLAIN_OWN_DATA_PROTOTYPES_REQUIRED);
  if (!(keys.length <= (array ? 8193 : 64) && keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)))) spec.fail(code, BOUNDED_OWN_FIELDS_REQUIRED);
  st.ancestors.add(object); let result: unknown;
  if (array) {
    const length = descriptors.length.value as number;
    if (!(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1)) spec.fail(code, spec.dense ?? DENSE_BOUNDED_OWN_ARRAYS_REQUIRED);
    const out: unknown[] = new Array(length);
    for (let index = 0; index < length; index++) {
      if (!Object.hasOwn(descriptors, String(index))) spec.fail(code, spec.sparse ?? SPARSE_ARRAY_FIELDS_REFUSED);
      out[index] = copyOwn(st, descriptors[String(index)].value, depth + 1);
    }
    result = out;
  } else {
    // (Object.fromEntries, as the copies had: a `__proto__` field stays an own field.)
    const entries: [string, unknown][] = [];
    for (const key of keys as string[]) entries.push([key, copyOwn(st, descriptors[key].value, depth + 1)]);
    result = Object.fromEntries(entries);
  }
  st.ancestors.delete(object); return result;
}
