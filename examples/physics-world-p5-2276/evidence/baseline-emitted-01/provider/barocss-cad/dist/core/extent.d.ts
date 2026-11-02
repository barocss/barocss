/**
 * Math.min / Math.max over an array without spreading it into arguments (no call-stack limit on mesh-sized arrays, no
 * argument copy). The same result as the spread form: NaN if any entry is NaN, −0 below +0, ±Infinity when empty.
 */
export declare function minOf(xs: ArrayLike<number>): number;
export declare function maxOf(xs: ArrayLike<number>): number;
/** minOf / maxOf of coordinate k of a list of points. */
export declare function minAt(ps: readonly (ArrayLike<number>)[], k: number): number;
export declare function maxAt(ps: readonly (ArrayLike<number>)[], k: number): number;
