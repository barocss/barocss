// The exact piece of a NURBS curve between two of its parameters (D90): knots inserted (Boehm, in homogeneous
// coordinates) to full multiplicity at both ends and the poles between kept — the same curve, no refit. A Boolean's
// boundary that is a piece of an input edge (a fillet tool's contact) stays that edge's own curve, one edge, rather than
// a chain of fitted Hermite pieces that cannot follow its interior knots.
import { curveDomain } from '../../math.js';
import type { Curve, Point } from '../../types.js';

type H = [number, number, number, number];
/** One knot u inserted once into (degree, knots, homogeneous poles). */
function insertOnce(p: number, knots: number[], P: H[], u: number): { knots: number[]; P: H[] } {
  let k = p; while (k + 1 < knots.length - p - 1 && knots[k + 1] <= u) k++;
  const Q: H[] = [];
  for (let i = 0; i <= P.length; i++) {
    if (i <= k - p) Q.push(P[i]);
    else if (i > k) Q.push(P[i - 1]);
    else {
      const den = knots[i + p] - knots[i], a = den > 0 ? (u - knots[i]) / den : 0;
      Q.push([0, 1, 2, 3].map(j => (1 - a) * P[i - 1][j] + a * P[i][j]) as H);
    }
  }
  return { knots: [...knots.slice(0, k + 1), u, ...knots.slice(k + 1)], P: Q };
}
/** The curve between parameters a < b (within its domain), as its own curve on [a, b]. */
export function curvePiece(c: Curve, a: number, b: number, id: string): Curve {
  const p = c.degree, [lo, hi] = curveDomain(c);
  let knots = [...c.knots], P: H[] = c.controlPoints.map((q, i) => [q[0] * c.weights[i], q[1] * c.weights[i], q[2] * c.weights[i], c.weights[i]]);
  for (const u of [a, b]) {
    if (u <= lo || u >= hi) continue;
    const have = knots.filter(k => k === u).length;
    for (let m = have; m < p; m++) ({ knots, P } = insertOnce(p, knots, P, u));
  }
  // The poles of the span [a, b]: from the first knot a at full multiplicity to the last b.
  const first = a <= lo ? 0 : knots.indexOf(a) - 1, last = b >= hi ? P.length - 1 : knots.lastIndexOf(b) - p;
  const poles = P.slice(first, last + 1), kn = [a, ...knots.slice(first + 1, last + p + 1), b];
  return { kind: 'curve', id, degree: p, knots: kn, controlPoints: poles.map(h => [h[0] / h[3], h[1] / h[3], h[2] / h[3]] as Point), weights: poles.map(h => h[3]) };
}
/** The same curve the other way round (its parameter u ↦ lo + hi − u). */
export function curveReversed(c: Curve): Curve {
  const [lo, hi] = [c.knots[0], c.knots[c.knots.length - 1]];
  return { ...c, knots: c.knots.map(k => lo + hi - k).reverse(), controlPoints: [...c.controlPoints].reverse(), weights: [...c.weights].reverse() };
}
