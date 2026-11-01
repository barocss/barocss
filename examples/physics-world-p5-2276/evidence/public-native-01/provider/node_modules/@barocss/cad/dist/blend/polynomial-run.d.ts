import type { Surface } from '../types.js';
/**
 * INTERNAL: extend a single polynomial Bezier direction by one quarter of its domain at both ends.
 * Knots move with the new controls: every point in the original domain stays on the same polynomial.
 * Rational, periodic and multi-span directions keep their original domain. Used only for an open fillet's solve;
 * the body's surfaces and trims are never replaced. No offset fit or larger contact tolerance is introduced.
 */
export declare function polynomialRunSurface(surface: Surface): Surface;
