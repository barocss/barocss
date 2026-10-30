// Curves made in the studio, written as a CAD source (`.barocad`) for the direct geometry: a sketch's
// lines and arcs, or a model edge, each one degree-2 rational NURBS curve — a line span with its middle
// pole, an arc in spans of a quarter turn or less (weights cos ½θ) — joined where the pieces meet.
import type { SketchPlane } from '../sketch/plane';
import { toWorld } from '../sketch/plane';
import { arcOf } from '../sketch/profile';
import type { DisplayMesh, Vec3 } from './mesh';

type P2 = [number, number];
export interface NurbsCurve { degree: number; knots: number[]; points: Vec3[]; weights: number[] }

/** Spans (P0, P1, P2, w1) of degree-2 rational Béziers, in order, as one curve with C0 joints. */
function fromSpans(spans: { p0: Vec3; p1: Vec3; p2: Vec3; w: number }[]): NurbsCurve {
  const points: Vec3[] = [spans[0].p0], weights = [1], knots = [0, 0, 0];
  spans.forEach((s, k) => { points.push(s.p1, s.p2); weights.push(s.w, 1); knots.push(...(k === spans.length - 1 ? [k + 1, k + 1, k + 1] : [k + 1, k + 1])); });
  return { degree: 2, knots, points, weights };
}
const mid3 = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
/** An arc about `c` (plane coordinates) from angle t0 by sw, as spans of at most a quarter turn. */
function arcSpans(plane: SketchPlane, c: P2, r: number, t0: number, sw: number) {
  const n = Math.max(1, Math.ceil(Math.abs(sw) / (Math.PI / 2) - 1e-9)), d = sw / n, out: { p0: Vec3; p1: Vec3; p2: Vec3; w: number }[] = [];
  for (let k = 0; k < n; k++) {
    const a = t0 + d * k, b = a + d, m = (a + b) / 2, R = r / Math.cos(d / 2);
    const at = (t: number, rr: number) => toWorld(plane, [c[0] + rr * Math.cos(t), c[1] + rr * Math.sin(t)]);
    out.push({ p0: at(a, r), p1: at(m, R), p2: at(b, r), w: Math.cos(d / 2) });
  }
  return out;
}

/** A sketch outline (points, bulges) as one curve in 3D; closed outlines return to their start. */
export function outlineCurve(plane: SketchPlane, points: P2[], bulges: number[] | undefined, closed: boolean): NurbsCurve {
  const n = points.length, spans: { p0: Vec3; p1: Vec3; p2: Vec3; w: number }[] = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = points[i], b = points[(i + 1) % n], bulge = bulges?.[i] ?? 0;
    if (!bulge) { const A = toWorld(plane, a), B = toWorld(plane, b); spans.push({ p0: A, p1: mid3(A, B), p2: B, w: 1 }); continue; }
    const arc = arcOf(a, b, bulge); spans.push(...arcSpans(plane, arc.center, arc.radius, arc.start, arc.sweep));
  }
  return fromSpans(spans);
}
export const circleCurve = (plane: SketchPlane, c: P2, r: number): NurbsCurve => fromSpans(arcSpans(plane, c, r, 0, 2 * Math.PI));

/**
 * A model edge as a curve, from its display polyline: a straight line, a circle or an arc of one when
 * its points lie on one (to 1e-4 of its radius), else the polyline itself (degree 1, at most 64 poles).
 */
export function edgeCurve(mesh: DisplayMesh, edge: number): NurbsCurve | null {
  const e = mesh.edges[edge]; if (!e) return null;
  if (e.straight) return { degree: 1, knots: [0, 0, 1, 1], points: [[...e.a] as Vec3, [...e.b] as Vec3], weights: [1, 1] };
  const pts: Vec3[] = [], L = mesh.edgeLines;
  for (let s = 0; 2 * s < mesh.edgeOfSegment.length; s++) if (mesh.edgeOfSegment[2 * s] === edge) {
    const a: Vec3 = [L[6 * s], L[6 * s + 1], L[6 * s + 2]], b: Vec3 = [L[6 * s + 3], L[6 * s + 4], L[6 * s + 5]];
    if (!pts.length) pts.push(a); else if (Math.hypot(...pts[pts.length - 1].map((v, k) => v - a[k]) as Vec3) > 1e-9) pts.push(a);
    pts.push(b);
  }
  if (pts.length < 3) return null;
  // A circle through three of its points, and the plane they span.
  const [p, q, r] = [pts[0], pts[Math.floor(pts.length / 3)], pts[Math.floor(2 * pts.length / 3)]];
  const u = q.map((v, k) => v - p[k]) as Vec3, w = r.map((v, k) => v - p[k]) as Vec3, nrm: Vec3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], nl = Math.hypot(...nrm);
  if (nl > 1e-12) {
    const N = nrm.map(v => v / nl) as Vec3, X = u.map(v => v / Math.hypot(...u)) as Vec3, plane: SketchPlane = { origin: p, normal: N, xAxis: X };
    const Y: Vec3 = [N[1] * X[2] - N[2] * X[1], N[2] * X[0] - N[0] * X[2], N[0] * X[1] - N[1] * X[0]];
    const loc = (P: Vec3): P2 => { const d = P.map((v, k) => v - p[k]); return [d[0] * X[0] + d[1] * X[1] + d[2] * X[2], d[0] * Y[0] + d[1] * Y[1] + d[2] * Y[2]]; };
    const [a2, b2, c2] = [loc(p), loc(q), loc(r)], dd = 2 * (a2[0] * (b2[1] - c2[1]) + b2[0] * (c2[1] - a2[1]) + c2[0] * (a2[1] - b2[1]));
    if (Math.abs(dd) > 1e-12) {
      const s2 = (v: P2) => v[0] * v[0] + v[1] * v[1];
      const C: P2 = [(s2(a2) * (b2[1] - c2[1]) + s2(b2) * (c2[1] - a2[1]) + s2(c2) * (a2[1] - b2[1])) / dd, (s2(a2) * (c2[0] - b2[0]) + s2(b2) * (a2[0] - c2[0]) + s2(c2) * (b2[0] - a2[0])) / dd];
      const R = Math.hypot(a2[0] - C[0], a2[1] - C[1]);
      const flat = pts.every(P => { const d = P.map((v, k) => v - p[k]); return Math.abs(d[0] * N[0] + d[1] * N[1] + d[2] * N[2]) < 1e-4 * R; });
      if (flat && pts.every(P => { const l = loc(P); return Math.abs(Math.hypot(l[0] - C[0], l[1] - C[1]) - R) < 1e-4 * R; })) {
        const ang = (P: Vec3) => { const l = loc(P); return Math.atan2(l[1] - C[1], l[0] - C[0]); };
        const closed = Math.hypot(...pts[0].map((v, k) => v - pts[pts.length - 1][k]) as Vec3) < 1e-6 * R;
        // The way round: the sum of the turns between the samples.
        let sw = 0; for (let k = 1; k < pts.length; k++) { let t = ang(pts[k]) - ang(pts[k - 1]); if (t > Math.PI) t -= 2 * Math.PI; if (t < -Math.PI) t += 2 * Math.PI; sw += t; }
        if (closed) sw = Math.sign(sw || 1) * 2 * Math.PI;
        return fromSpans(arcSpans(plane, C, R, ang(pts[0]), sw));
      }
    }
  }
  const step = Math.max(1, Math.ceil((pts.length - 1) / 63)), poly = pts.filter((_, k) => k % step === 0 || k === pts.length - 1);
  return { degree: 1, knots: [0, ...poly.map((_, k) => k), poly.length - 1], points: poly, weights: poly.map(() => 1) };
}

// (Plain decimals only: the source language reads no exponents, and String gives one below 1e-6.)
const num = (v: number) => { const r = Math.round(v * 1e9) / 1e9; if (r === 0) return '0'; const s = String(r); return s.includes('e') ? r.toFixed(9).replace(/0+$/, '') : s; };
/** Curves as one CAD source model `name` (curve ids c1, c2 …). */
export function curvesSource(name: string, curves: NurbsCurve[]): string {
  const id = name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^[^A-Za-z_]/, '_') || 'curves';
  const body = curves.map((c, k) => `  @curve #c${k + 1} { type: nurbs; degree: ${c.degree}; knots: [${c.knots.map(num).join(',')}]; control-points: [${c.points.map(p => `[${p.map(num).join(',')}]`).join(',')}]; weights: [${c.weights.map(num).join(',')}]; }`).join('\n');
  return `@model ${id} {\n  version: 0;\n  length-unit: mm;\n${body}\n}`;
}

export interface NurbsSurface { degreeU: number; degreeV: number; knotsU: number[]; knotsV: number[]; points: Vec3[][]; weights: number[][] }
/** Surfaces as one CAD source model `name` (surface ids s1, s2 …). */
export function surfacesSource(name: string, surfaces: NurbsSurface[]): string {
  const id = name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^[^A-Za-z_]/, '_') || 'surfaces';
  const body = surfaces.map((s, k) => `  @surface #s${k + 1} { type: nurbs; degree-u: ${s.degreeU}; degree-v: ${s.degreeV}; knots-u: [${s.knotsU.map(num).join(',')}]; knots-v: [${s.knotsV.map(num).join(',')}]; control-points: [${s.points.map(r => `[${r.map(p => `[${p.map(num).join(',')}]`).join(',')}]`).join(',')}]; weights: [${s.weights.map(r => `[${r.map(num).join(',')}]`).join(',')}]; }`).join('\n');
  return `@model ${id} {\n  version: 0;\n  length-unit: mm;\n${body}\n}`;
}
