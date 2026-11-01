/**
 * The kernel's own-data checks, shared (P3): many modules take their input only as plain own data — a bounded,
 * acyclic snapshot of plain objects and dense arrays of finite numbers, booleans, strings and null — and check
 * records for exactly their fields. Each module keeps its own refusal (its error class and codes) and passes it in; the
 * checks, their order and their messages live here once.
 */
export declare const OWN_VALUE_BUDGET_EXCEEDED = "Own value/depth budget exceeded";
export declare const FINITE_OWN_NUMBERS_REQUIRED = "Finite own numbers are required";
export declare const FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED = "Finite represented own numbers are required";
export declare const OWN_STRING_BUDGET_EXCEEDED = "Own string budget exceeded";
export declare const ACYCLIC_OWN_DATA_REQUIRED = "Acyclic own data is required";
export declare const PLAIN_OWN_DATA_PROTOTYPES_REQUIRED = "Plain own-data prototypes are required";
export declare const BOUNDED_OWN_FIELDS_REQUIRED = "Bounded fields without getters/symbols/hidden data are required";
export declare const DENSE_BOUNDED_OWN_ARRAYS_REQUIRED = "Dense bounded own arrays are required";
export declare const DENSE_BOUNDED_ARRAYS_REQUIRED = "Dense bounded arrays are required";
export declare const SPARSE_ARRAY_FIELDS_REFUSED = "Sparse/extra array fields are refused";
export declare const SPARSE_OWN_ARRAY_FIELDS_REFUSED = "Sparse/extra own array fields are refused";
export declare const OWN_SNAPSHOT_FAILED = "Own snapshot failed";
export declare const OWN_RECORD_REQUIRED = "An own record is required";
export declare const EXACT_OWN_FIELDS_REQUIRED = "Exact own fields are required";
export declare const OWN_RECORD = "own record";
export declare const EXACT_FIELDS_REQUIRED = "exact fields required: ";
/** Whether a value is an object that is not an array (a record to read fields from). */
export declare const isOwnRecord: (input: unknown) => input is Record<string, unknown>;
/** Whether a record has exactly these own fields (no more, none missing). */
export declare const hasExactOwnFields: (data: Record<string, unknown>, fields: readonly string[]) => boolean;
/** A module's refusal and wording for `ownSnapshot`. */
export interface OwnSnapshotSpec<C> {
    /** Codes: bad input, bad data a caller owns (`owned`), and an input past the budgets. */
    readonly input: C;
    readonly owned: C;
    readonly budget: C;
    /** Throw the module's refusal. */
    readonly fail: (code: C, detail: string) => never;
    /** Throw the module's refusal for something else thrown while copying (its cause). */
    readonly wrap: (code: C, detail: string, cause: unknown) => never;
    /** Whether something thrown is already the module's refusal (passed on as it is). */
    readonly isRefusal: (e: unknown) => boolean;
    /** The module's wording where modules differ (defaults: the first form of each). */
    readonly finite?: string;
    readonly dense?: string;
    readonly sparse?: string;
}
/**
 * A deep copy of plain own data, refused unless it is within budget (1 048 576 values, depth 64, strings of 262 144,
 * 64 fields a record, 8 192 entries an array), acyclic, of plain prototypes, without getters, symbols or hidden fields,
 * with dense arrays and finite numbers. `owned`: the data is the caller's own (every refusal then has the `owned` code).
 */
export declare function ownSnapshot<C>(input: unknown, owned: boolean, spec: OwnSnapshotSpec<C>): unknown;
