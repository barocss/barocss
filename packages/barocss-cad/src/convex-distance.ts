// K1 (D140): the distance between two convex point sets — GJK (Gilbert–Johnson–Keerthi) with the closest-point
// sub-algorithm on the simplex (a point, segment, triangle or tetrahedron of the Minkowski difference; Ericson's
// regions), our own; moved down from the studio's robot track (RM6, O19), where the links' convex hulls are the sets
// and a distance above zero proves two links apart (the collision sweep's prefilter). 0 when they touch or overlap.
import { add as addV, cross, dot, scale, sub } from './vec3.js';

type V = [number, number, number];
interface Closest { p: V; s: V[] }

/** The point of `pts` farthest along d (a support point). */
function support(pts: ArrayLike<number>, d: V): V {
  let best = -Infinity, k = 0;
  for (let i = 0; i < pts.length; i += 3) { const v = pts[i] * d[0] + pts[i + 1] * d[1] + pts[i + 2] * d[2]; if (v > best) { best = v; k = i; } }
  return [pts[k], pts[k + 1], pts[k + 2]];
}
/** Whether the origin lies on the far side of face pqr from the tetrahedron's fourth corner o. */
function originOutside(p: V, q: V, r: V, o: V): boolean { const n = cross(sub(q, p), sub(r, p)); return dot(scale(p, -1), n) * dot(sub(o, p), n) < 0; }
/** The point of a simplex closest to the origin, and the smallest sub-simplex holding it. */
function closest(s: V[]): Closest {
  if (s.length === 1) return { p: s[0], s };
  if (s.length === 2) {
    const [a, b] = s, ab = sub(b, a), t = -dot(a, ab) / (dot(ab, ab) || 1);
    if (t <= 0) return { p: a, s: [a] }; if (t >= 1) return { p: b, s: [b] };
    return { p: addV(a, scale(ab, t)), s };
  }
  if (s.length === 3) return triangle(s[0], s[1], s[2]);
  // A tetrahedron: the origin inside it, or the closest of the faces it lies beyond.
  const [a, b, c, d] = s;
  let best: Closest | null = null, bd = Infinity;
  for (let f = 0; f < 4; f++) {
    const p = f === 3 ? b : a, q = f === 0 ? b : f === 1 ? c : d, r = f === 0 ? c : f === 1 ? d : f === 2 ? b : c, o = f === 0 ? d : f === 1 ? b : f === 2 ? c : a;
    if (!originOutside(p, q, r, o)) continue;
    const t = triangle(p, q, r), dd = dot(t.p, t.p);
    if (dd < bd) { bd = dd; best = t; }
  }
  return best ?? { p: [0, 0, 0], s };
}
/** The closest point to the origin on triangle abc (Ericson 5.1.5), and its sub-simplex. */
function triangle(a: V, b: V, c: V): Closest {
  const ab = sub(b, a), ac = sub(c, a), ap = scale(a, -1);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return { p: a, s: [a] };
  const bp = scale(b, -1), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return { p: b, s: [b] };
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return { p: addV(a, scale(ab, v)), s: [a, b] }; }
  const cp = scale(c, -1), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return { p: c, s: [c] };
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return { p: addV(a, scale(ac, w)), s: [a, c] }; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return { p: addV(b, scale(sub(c, b), w)), s: [b, c] }; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return { p: addV(a, addV(scale(ab, v), scale(ac, w))), s: [a, b, c] };
}
/** Whether w is already a corner of the simplex (no progress: the search has ended). */
function inSimplex(s: readonly V[], w: V): boolean { for (const x of s) if (x[0] === w[0] && x[1] === w[1] && x[2] === w[2]) return true; return false; }

/** The distance between the convex hulls of two point sets (x, y, z each); 0 when they meet. */
export function convexDistance(a: ArrayLike<number>, b: ArrayLike<number>, tol = 1e-10): number {
  let d: V = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  if (dot(d, d) === 0) d = [1, 0, 0];
  let s: V[] = [sub(support(a, scale(d, -1)), support(b, d))], dist = Infinity;
  for (let it = 0; it < 64; it++) {
    const c = closest(s), p = c.p, pp = Math.sqrt(dot(p, p));
    s = c.s;
    if (pp <= tol || s.length === 4) return 0;
    // (The support of the difference against p: no point of it nearer the origin along p → p is the closest.)
    const w = sub(support(a, scale(p, -1)), support(b, p)), gap = pp - dot(w, p) / pp;
    dist = Math.min(dist, pp);
    if (gap <= tol * Math.max(1, pp) || inSimplex(s, w)) return pp;
    s = [...s, w];
  }
  return dist;
}
