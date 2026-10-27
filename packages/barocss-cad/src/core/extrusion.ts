import { preflightExtrusion } from '../features/extrusion-validation.js';
import type { Curve, Point, Surface } from '../types.js';

export interface ExtrusionOptions { id: string; vector: Point }

/**
 * Construct an open rational surface S(u,v) = C(u) + vD, v in [0,1].
 * Output poles use binary64 addition. This operation supplies no caps, solid
 * topology or regularity certificate; a folded/singular surface can fail preview.
 */
export function extrudeCurve(curve: Curve, options: ExtrusionOptions): Surface {
  const { id, vector } = preflightExtrusion(curve, options);
  return {
    kind: 'surface', id, degreeU: curve.degree, degreeV: 1,
    knotsU: [...curve.knots], knotsV: [0, 0, 1, 1],
    controlPoints: curve.controlPoints.map((point): Point[] => [
      [point[0], point[1], point[2]],
      [point[0] + vector[0], point[1] + vector[1], point[2] + vector[2]],
    ]),
    weights: curve.weights.map((weight) => [weight, weight]),
  };
}
