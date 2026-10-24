// O24 (c): what mates read from a part's B-rep beyond the kernel's flat and round faces — spheres and cones (the
// kernel's faceGeometry calls them `other`), straight and circular edges by their persistent names, a flat face's area
// centroid and a round face's extent along its axis. Own TypeScript over the kernel's NURBS evaluation: a surface is a
// sphere when its samples sit at one distance from a least-squares centre; a cone when its two boundary iso-curves are
// circles (or a point, the apex) on one axis with different radii and its samples lie on that cone. Each test is within
// the kernel's linear tolerance at the part's scale; anything else stays unmateable.
import { curveDomain, evaluateCurve, evaluateSurface, surfaceDomain, type Brep } from '@barocss/cad';
import { clean } from '../engine/placement';
import type { MateFace, Vec3 } from './mates';

type P = readonly number[];
const sub = (a: P, b: P): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addTo = (a: P, b: P): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: P, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: P, b: P) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: P, b: P): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: P) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: P): Vec3 => scale(a, 1 / len(a));
const snap = (p: P): Vec3 => [clean(p[0]), clean(p[1]), clean(p[2])];
const snapUnit = (p: P): Vec3 => unit([clean(p[0], 1e-12), clean(p[1], 1e-12), clean(p[2], 1e-12)]);
const snapAngle = (x: number) => { const d = x * 180 / Math.PI, r = Math.round(d * 1e6) / 1e6; return Math.abs(d - r) < 1e-9 ? r * Math.PI / 180 : x; };

/** A tolerance for a shape about `size` mm across: the kernel's own linear one (1e-6 relative), at least 1e-7 mm. */
const tolFor = (size: number) => Math.max(1e-7, 1e-6 * size);
type Surface = Extract<Brep['faces'][number]['surface'], { controlPoints: unknown }>;
type Face = Brep['faces'][number];

/** A grid of a surface's points, n × n over its domain (borders included). */
function grid(S: Surface, n: number): Vec3[] {
  const d = surfaceDomain(S), out: Vec3[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p = evaluateSurface(S, d.u[0] + (d.u[1] - d.u[0]) * i / (n - 1), d.v[0] + (d.v[1] - d.v[0]) * j / (n - 1));
    out.push([p[0], p[1], p[2]]);
  }
  return out;
}
/** The outward normal at the middle of a face (∂u × ∂v by its sense). */
function outwardAt(face: Face, S: Surface): { p: Vec3; n: Vec3 } {
  const d = surfaceDomain(S), u = (d.u[0] + d.u[1]) / 2, v = (d.v[0] + d.v[1]) / 2, du = 1e-6 * (d.u[1] - d.u[0]), dv = 1e-6 * (d.v[1] - d.v[0]);
  const p = evaluateSurface(S, u, v), pu = evaluateSurface(S, u + du, v), pv = evaluateSurface(S, u, v + dv);
  const n = unit(cross(sub(pu, p), sub(pv, p)));
  return { p: [p[0], p[1], p[2]], n: face.sense === 'forward' ? n : scale(n, -1) };
}
/** Solves a 4 × 4 system (Gaussian elimination, partial pivots), or null when singular. */
function solve4(A: number[][], b: number[]): number[] | null {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 4; c++) {
    let piv = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-14) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < 4; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 5; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[4] / M[i][i]);
}
/** A sphere through the points (least squares on |p|² = 2c·p + k), or null when they are not on one. */
function sphereThrough(pts: readonly Vec3[]): { c: Vec3; r: number } | null {
  const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], b = [0, 0, 0, 0];
  for (const p of pts) {
    const row = [2 * p[0], 2 * p[1], 2 * p[2], 1], y = dot(p, p);
    for (let i = 0; i < 4; i++) { b[i] += row[i] * y; for (let j = 0; j < 4; j++) A[i][j] += row[i] * row[j]; }
  }
  const x = solve4(A, b); if (!x) return null;
  const c: Vec3 = [x[0], x[1], x[2]], r2 = x[3] + dot(c, c);
  if (!(r2 > 0)) return null;
  const r = Math.sqrt(r2), tol = tolFor(r);
  for (const p of pts) if (Math.abs(len(sub(p, c)) - r) > tol) return null;
  return { c, r };
}
/** A circle through three points (its centre, unit normal by their order, radius), or null when they are in a line. */
function circleThrough(a: P, b: P, c: P): { c: Vec3; n: Vec3; r: number } | null {
  const ab = sub(b, a), ac = sub(c, a), n = cross(ab, ac), nn = dot(n, n);
  if (nn < 1e-24 * Math.max(1, dot(ab, ab) * dot(ac, ac))) return null;
  // (The circumcentre: a + (|ac|² (n × ab) + |ab|² (ac × n)) / 2|n|².)
  const o = addTo(a, scale(addTo(scale(cross(n, ab), dot(ac, ac)), scale(cross(ac, n), dot(ab, ab))), 1 / (2 * nn)));
  return { c: o, n: unit(n), r: len(sub(a, o)) };
}
/** Points all on one circle (centre, unit normal, radius), or all one point (r 0), or null. */
function ringOf(pts: readonly Vec3[]): { c: Vec3; n: Vec3 | null; r: number } | null {
  let span = 0;
  for (const p of pts) span = Math.max(span, len(sub(p, pts[0])));
  if (span <= tolFor(len(pts[0]))) return { c: pts[0], n: null, r: 0 };
  const k = pts.length, circ = circleThrough(pts[0], pts[Math.floor(k / 3)], pts[Math.floor(2 * k / 3)]);
  if (!circ) return null;
  const tol = tolFor(circ.r + len(circ.c));
  for (const p of pts) if (Math.abs(len(sub(p, circ.c)) - circ.r) > tol || Math.abs(dot(sub(p, circ.c), circ.n)) > tol) return null;
  return circ;
}
/** An iso-curve's points: along u at v (dir 0) or along v at u (dir 1), n of them. */
function iso(S: Surface, dir: 0 | 1, at: number, n: number): Vec3[] {
  const d = surfaceDomain(S), out: Vec3[] = [], [lo, hi] = dir === 0 ? d.u : d.v;
  for (let i = 0; i < n; i++) { const t = lo + (hi - lo) * i / (n - 1), p = dir === 0 ? evaluateSurface(S, t, at) : evaluateSurface(S, at, t); out.push([p[0], p[1], p[2]]); }
  return out;
}
/** A cone: its two boundary iso-curves one way are circles (or the apex) on one axis with different radii. */
function coneOf(S: Surface): { apex: Vec3; axis: Vec3; half: number } | null {
  const d = surfaceDomain(S);
  for (const dir of [0, 1] as const) {
    const [lo, hi] = dir === 0 ? d.v : d.u, r0 = ringOf(iso(S, dir, lo, 7)), r1 = ringOf(iso(S, dir, hi, 7));
    if (!r0 || !r1 || Math.abs(r0.r - r1.r) <= tolFor(Math.max(r0.r, r1.r))) continue;
    const n = r0.n ?? r1.n; if (!n) continue;
    if (r0.n && r1.n && Math.abs(Math.abs(dot(r0.n, r1.n)) - 1) > 1e-9) continue;
    const along = sub(r1.c, r0.c), h = len(along);
    if (h <= tolFor(h) || len(cross(along, n)) > tolFor(h)) continue;
    // (The apex: where the rule lines meet the axis, past the smaller circle; the axis from it toward the base.)
    const big = r0.r > r1.r ? r0 : r1, small = big === r0 ? r1 : r0, toward = unit(sub(big.c, small.c));
    const apex = sub(small.c, scale(toward, small.r * h / (big.r - small.r))), half = Math.atan2(big.r - small.r, h);
    const tol = tolFor(big.r + h), tan = Math.tan(half);
    let onIt = true;
    for (const p of grid(S, 5)) { const q = sub(p, apex), t = dot(q, toward); if (Math.abs(len(sub(q, scale(toward, t))) - t * tan) > tol) { onIt = false; break; } }
    if (onIt) return { apex, axis: toward, half };
  }
  return null;
}

/** A face the kernel calls `other`, as a sphere or a cone when it is one (in the part's coordinates), else null. */
export function curvedFace(face: Face): MateFace | null {
  if (face.surface.kind === 'facets') return null;
  const S = face.surface as Surface, mid = outwardAt(face, S);
  const s = sphereThrough(grid(S, 5));
  if (s) return { kind: 'sphere', point: snap(s.c), radius: clean(s.r), outer: dot(mid.n, sub(mid.p, s.c)) > 0 };
  const c = coneOf(S);
  if (!c) return null;
  const q = sub(mid.p, c.apex), radial = sub(q, scale(c.axis, dot(q, c.axis)));
  return { kind: 'cone', point: snap(c.apex), axis: snapUnit(c.axis), half: snapAngle(c.half), outer: dot(mid.n, radial) > 0 };
}

/** An edge's points in its own direction: a line's two ends, any other curve `EDGE_SAMPLES` along it. */
const EDGE_SAMPLES = 9;
export function edgePoints(edge: Brep['edges'][number]): Vec3[] {
  const [t0, t1] = curveDomain(edge.curve), straight = edge.curve.degree === 1 && edge.curve.controlPoints.length === 2, n = straight ? 2 : EDGE_SAMPLES, out: Vec3[] = [];
  for (let k = 0; k < n; k++) { const p = evaluateCurve(edge.curve, t0 + (t1 - t0) * k / (n - 1)); out.push([p[0], p[1], p[2]]); }
  return out;
}
/** An edge as a mate reads it: a straight one (start, direction, length) or a circular one (centre, normal, radius, an arc's ends). */
export function edgeShape(pts: readonly Vec3[], closed: boolean): MateFace | null {
  const a = pts[0], b = pts[pts.length - 1], d = sub(b, a), l = len(d), tol = tolFor(Math.max(l, len(a)));
  let straight = !closed && l > tol;
  for (let k = 1; straight && k < pts.length - 1; k++) straight = len(cross(sub(pts[k], a), d)) / l <= tol;
  if (straight) return { kind: 'line', point: snap(a), axis: snapUnit(d), length: clean(l) };
  const ring = ringOf(pts);
  if (!ring || !ring.n || ring.r <= tol) return null;
  return { kind: 'circle', point: snap(ring.c), axis: snapUnit(ring.n), radius: clean(ring.r), ...(closed ? {} : { ends: [snap(a), snap(b)] as [Vec3, Vec3] }) };
}
/** An edge's name with its pieces' and faces' piece marks taken off (`n1.bottom|n1.side0#2` → `n1.bottom|n1.side0`), or null for a seam (a face meeting itself). */
export function edgeKey(name: string): string | null {
  const sides = name.split('|').map(s => s.replace(/(#\d+)+$/, ''));
  return sides.length === 2 && sides[0] === sides[1] ? null : sides.join('|');
}
/** Two pieces of one edge name that are one circle or one line (merged), or null when they are not. */
export function mergeEdges(x: MateFace, y: MateFace): MateFace | null {
  if (x.kind === 'circle' && y.kind === 'circle') {
    const tol = tolFor(x.radius + len(x.point));
    if (len(sub(x.point, y.point)) > tol || Math.abs(x.radius - y.radius) > tol || Math.abs(Math.abs(dot(x.axis, y.axis)) - 1) > 1e-9) return null;
    return { kind: 'circle', point: x.point, axis: x.axis, radius: x.radius };
  }
  if (x.kind === 'line' && y.kind === 'line') {
    const tol = tolFor(x.length + len(x.point));
    if (Math.abs(Math.abs(dot(x.axis, y.axis)) - 1) > 1e-9 || len(cross(sub(y.point, x.point), x.axis)) > tol) return null;
    const ends = [0, x.length, dot(sub(y.point, x.point), x.axis), dot(addTo(y.point, scale(y.axis, y.length)), x.axis) - dot(x.point, x.axis)], lo = Math.min(...ends), hi = Math.max(...ends);
    return { kind: 'line', point: snap(addTo(x.point, scale(x.axis, lo))), axis: x.axis, length: clean(hi - lo) };
  }
  return null;
}

/** A loop's points in order (each coedge's edge points, reversed when it runs backward). */
export function loopPoints(brep: Brep, loop: Brep['loops'][number], coedges: ReadonlyMap<string, Brep['coedges'][number]>, edgePts: ReadonlyMap<string, Vec3[]>): Vec3[] {
  const out: Vec3[] = [];
  for (const cid of loop.coedges) {
    const c = coedges.get(cid)!, pts = edgePts.get(c.edge) ?? [];
    if (c.sense === 'forward') for (const p of pts) out.push(p); else for (let k = pts.length - 1; k >= 0; k--) out.push(pts[k]);
  }
  return out;
}
/** A flat region's area and first moment about the origin, from its loops' points (outer loops add, inner ones take away). */
export function planeMoment(loops: readonly { pts: readonly Vec3[]; outer: boolean }[], n: Vec3): { area: number; moment: Vec3 } {
  let area = 0, moment: Vec3 = [0, 0, 0];
  for (const l of loops) {
    let a = 0, m: Vec3 = [0, 0, 0];
    const p0 = l.pts[0];
    for (let k = 1; k + 1 < l.pts.length; k++) {
      const t = dot(cross(sub(l.pts[k], p0), sub(l.pts[k + 1], p0)), n) / 2;
      a += t; m = addTo(m, scale(addTo(addTo(p0, l.pts[k]), l.pts[k + 1]), t / 3));
    }
    // (A loop's sense is its own: outer loops count positive, inner ones negative, whichever way they run.)
    const s = (l.outer ? 1 : -1) * (a < 0 ? -1 : 1);
    area += s * a; moment = addTo(moment, scale(m, s));
  }
  return { area, moment };
}
