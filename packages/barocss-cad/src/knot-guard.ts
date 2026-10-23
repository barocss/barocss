// The interior knots of a knot vector held at multiplicity ≥ degree (C0 joins), each once: one definition for the
// curve and surface operations that keep them.

/** The distinct knots strictly inside (min, max) that occur at least `degree` times. */
export function guardKnots(knots: number[], degree: number, min: number, max: number): number[] {
  return [...new Set(knots)].filter(k => k > min && k < max && knots.filter(x => x === k).length >= degree);
}
