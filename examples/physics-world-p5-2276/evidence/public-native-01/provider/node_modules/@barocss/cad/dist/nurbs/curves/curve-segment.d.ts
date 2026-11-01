import type { Curve } from '../../types.js';
/** The curve between parameters a < b (within its domain), as its own curve on [a, b]. */
export declare function curvePiece(c: Curve, a: number, b: number, id: string): Curve;
/** The same curve the other way round (its parameter u ↦ lo + hi − u). */
export declare function curveReversed(c: Curve): Curve;
