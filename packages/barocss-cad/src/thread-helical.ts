// Modelled ISO metric threads as helical B-spline faces (the faceted builder's exact-surface twin): the
// thread surface seen over (θ, φ) — the angle round the axis and the profile's phase, φ = z / P − θ / 2π —
// is four bands of the ISO 68-1 profile (a flank, the crest, the other flank, the root), each a ruled
// surface between two helices (the profile's radius is linear across a band). A band is cut into
// half-turn faces, cubic round (a Bézier span per quarter turn, the circle's best handle; z exact) and
// linear across: at most 7 poles. The ends at z0 and z1 cut the end turns along lines in (θ, φ), so those
// faces are trimmed by curves that lie exactly on them (degree 4: the surface along a line of its
// parameters) and in the end planes; the ends, the head's underside and the nut's faces are planes bounded
// by those curves and the hex.
import { assertValidBrep, buildBrep, lineCurve, type Brep, type BrepFaceInput } from './brep-core.js';
import { evaluateCurve, curveDomain } from './math.js';
import { isoThreadRadius, type ThreadSolidRequest } from './thread-solid.js';
import type { Curve, Surface } from './types.js';
import { lerp as lerp3 } from './vec3.js';

type P3 = [number, number, number];
/** A polygon corner in (θ, φ), and the kind of the side that leaves it. */
interface Corner { t: number; f: number; side: Side }
type Side = 'f0' | 'f1' | 't0' | 't1' | 'bottom' | 'top';
/** A side of a face as built: its curve (from `a` to `b`), its ends' points, the end plane it lies in, if any. */
interface Piece { curve: Curve; a: P3; b: P3; plane: 'bottom' | 'top' | null }
interface FaceDraft { surface: Surface; sense: 'forward' | 'reversed'; name: string; loops: { kind: 'outer' | 'inner'; pieces: Piece[] }[] }

const HALF = Math.PI, HANDLE = 4 / 3 * Math.tan(Math.PI / 8);
/** The profile's phase breaks over a period: a flank, the crest, the other flank, the root (across the period's end). */
const BREAKS = [-0.375, -0.0625, 0.0625, 0.375, 0.625];

/** A helix of radius r round (cx, cy) at phase φ over the half turn from θa: 7 cubic poles (two quarter-turn spans). */
function helixRow(cx: number, cy: number, r: number, f: number, ta: number, P: number): P3[] {
  const at = (t: number): P3 => [cx + r * Math.cos(t), cy + r * Math.sin(t), P * (f + t / (2 * Math.PI))], out: P3[] = [at(ta)];
  for (let s = 0; s < 2; s++) {
    const a = ta + s * HALF / 2, b = a + HALF / 2, A = at(a), B = at(b), dz = P / 12;
    out.push([A[0] - r * Math.sin(a) * HANDLE, A[1] + r * Math.cos(a) * HANDLE, A[2] + dz], [B[0] + r * Math.sin(b) * HANDLE, B[1] - r * Math.cos(b) * HANDLE, B[2] - dz], B);
  }
  return out;
}
/** A Bézier curve's piece over [ta, tb] (either way round), by de Casteljau. */
function bezierPiece(ctrl: readonly P3[], ta: number, tb: number): P3[] {
  if (ta > tb) return bezierPiece(ctrl, tb, ta).reverse();
  let c = ctrl.map(p => [...p] as P3);
  if (ta > 0) c = split(c, ta)[1];
  if (tb < 1) c = split(c, ta < 1 ? (tb - ta) / (1 - ta) : 0)[0];
  return c;
}
function split(ctrl: readonly P3[], t: number): [P3[], P3[]] {
  const left: P3[] = [], right: P3[] = []; let row = ctrl.map(p => [...p] as P3);
  while (row.length) { left.push(row[0]); right.unshift(row[row.length - 1]); const next: P3[] = []; for (let i = 0; i + 1 < row.length; i++) next.push(lerp3(row[i], row[i + 1], t)); row = next; }
  return [left, right];
}
/** The quartic Bézier of a ruled cubic span along v = L0 (1 − t) + L1 t: P(t) + v(t) (Q(t) − P(t)). */
function cutSpan(Pc: readonly P3[], Qc: readonly P3[], L0: number, L1: number): P3[] {
  const D = Pc.map((p, i) => [Qc[i][0] - p[0], Qc[i][1] - p[1], Qc[i][2] - p[2]] as P3), out: P3[] = [];
  // Weights of L_i D_j in the quartic's pole k (i + j = k): C(1,i) C(3,j) / C(4,k).
  const terms: [number, number, number][][] = [[[0, 0, 1]], [[0, 1, 3 / 4], [1, 0, 1 / 4]], [[0, 2, 1 / 2], [1, 1, 1 / 2]], [[0, 3, 1 / 4], [1, 2, 3 / 4]], [[1, 3, 1]]];
  for (let k = 0; k <= 4; k++) {
    // The cubic P raised to degree 4, plus the product's pole.
    const e = k / 4, base: P3 = k === 0 ? [...Pc[0]] as P3 : k === 4 ? [...Pc[3]] as P3 : [e * Pc[k - 1][0] + (1 - e) * Pc[k][0], e * Pc[k - 1][1] + (1 - e) * Pc[k][1], e * Pc[k - 1][2] + (1 - e) * Pc[k][2]];
    for (const [i, j, w] of terms[k]) { const L = i ? L1 : L0; base[0] += w * L * D[j][0]; base[1] += w * L * D[j][1]; base[2] += w * L * D[j][2]; }
    out.push(base);
  }
  return out;
}
/** Bézier pieces of one degree joined (C0) as one clamped B-spline curve. */
function joined(pieces: readonly P3[][], id: string): Curve {
  const n = pieces[0].length - 1, pts: P3[] = [...pieces[0]], knots = Array<number>(n + 1).fill(0);
  for (let k = 1; k < pieces.length; k++) { pts.push(...pieces[k].slice(1)); for (let i = 0; i < n; i++) knots.push(k / pieces.length); }
  knots.push(...Array<number>(n + 1).fill(1));
  return { kind: 'curve', id, degree: n, knots, controlPoints: pts, weights: pts.map(() => 1) };
}

/** The convex polygon of a band [f0, f1] over the half turn [ta, ta + π], within z0 ≤ P(φ + θ/2π) ≤ z1. */
function bandPolygon(ta: number, f0: number, f1: number, c0: number, c1: number): Corner[] {
  let poly: Corner[] = [{ t: ta, f: f0, side: 'f0' }, { t: ta + HALF, f: f0, side: 't1' }, { t: ta + HALF, f: f1, side: 'f1' }, { t: ta, f: f1, side: 't0' }];
  // z ≥ z0: φ + θ/2π ≥ c0; z ≤ z1: φ + θ/2π ≤ c1.
  poly = clip(poly, (t, f) => f + t / (2 * Math.PI) - c0, 'bottom');
  poly = clip(poly, (t, f) => c1 - f - t / (2 * Math.PI), 'top');
  // (Corners that coincide — a cut through a corner — are one.)
  const out: Corner[] = [];
  for (const c of poly) { const p = out[out.length - 1]; if (p && Math.abs(p.t - c.t) < 1e-12 && Math.abs(p.f - c.f) < 1e-12) { p.side = c.side; continue; } out.push(c); }
  while (out.length > 1 && Math.abs(out[0].t - out[out.length - 1].t) < 1e-12 && Math.abs(out[0].f - out[out.length - 1].f) < 1e-12) out.pop();
  return out;
}
/** Where the side p–q crosses g = 0 (g at its ends gp, gq), the side leaving it labelled `side`. */
function crossing(p: Corner, q: Corner, gp: number, gq: number, side: Side): Corner {
  const s = gp / (gp - gq); return { t: p.t + (q.t - p.t) * s, f: p.f + (q.f - p.f) * s, side };
}
/** Sutherland–Hodgman against g ≥ 0, the sides along the line labelled `side`. */
function clip(poly: Corner[], g: (t: number, f: number) => number, side: Side): Corner[] {
  const out: Corner[] = [], eps = 1e-13;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], gp = g(p.t, p.f), gq = g(q.t, q.f), pin = gp >= -eps, qin = gq >= -eps;
    if (pin && qin) out.push(p);
    else if (pin) { out.push(p); out.push(crossing(p, q, gp, gq, side)); }
    else if (qin) out.push(crossing(p, q, gp, gq, p.side));
  }
  return out;
}

/** The thread with exact (B-spline) helical faces: a rod, a hex bolt or a hex nut, as `threadSolid` builds them faceted. */
export function helicalThreadSolid(req: ThreadSolidRequest): Brep {
  const id = (req.id ?? 'thread').replace(/[^A-Za-z0-9_-]/g, '_').replace(/^(?=[^A-Za-z_])/, '_');
  const d = req.diameter, P = req.pitch, [cx, cy] = req.center ?? [0, 0], seat = req.seat ?? 0, hex = req.hex, nut = !!hex?.internal;
  if (!(d > 0 && P > 0 && P < d / 2)) throw new RangeError('a thread needs a diameter and a pitch below half of it');
  if (hex && !(hex.across > d && hex.height > 0)) throw new RangeError('a hex must be wider across flats than the thread and have a height');
  if (!nut && !((req.length ?? 0) > 0)) throw new RangeError('a threaded rod or shank needs a length');
  const clear = nut ? 0.04 : 0, z0 = nut ? seat : seat - req.length!, z1 = nut ? seat + hex!.height : seat, c0 = z0 / P, c1 = z1 / P;
  const radius = (f: number) => isoThreadRadius(d, P, f) + clear;
  const faces: FaceDraft[] = [], ends: Piece[] = [], tops: Piece[] = [];
  let nextCurve = 0, nextSurface = 0, nextThread = 0;
  const curveId = () => `${id}_k${nextCurve++}`;
  // Every band of every period the slab reaches, over both half turns.
  for (let m = Math.floor(c0 - 1) - 1; m <= Math.ceil(c1) + 1; m++) for (let b = 0; b < 4; b++) for (let h = 0; h < 2; h++) {
    const f0 = m + BREAKS[b], f1 = m + BREAKS[b + 1], ta = h * HALF, poly = bandPolygon(ta, f0, f1, c0, c1);
    if (poly.length < 3) continue;
    const A = helixRow(cx, cy, radius(f0), f0, ta, P), B = helixRow(cx, cy, radius(f1), f1, ta, P), df = f1 - f0;
    const surface: Surface = { kind: 'surface', id: `${id}_s${nextSurface++}`, degreeU: 3, degreeV: 1, knotsU: [0, 0, 0, 0, 0.5, 0.5, 0.5, 1, 1, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: A.map((p, i) => [p, B[i]]), weights: A.map(() => [1, 1]) };
    const uOf = (t: number) => (t - ta) / HALF, vOf = (f: number) => (f - f0) / df;
    const pieces: Piece[] = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], up = uOf(p.t), uq = uOf(q.t);
      let curve: Curve;
      if (p.side === 't0' || p.side === 't1') {
        // A ruling at a half turn's end: straight between the rows.
        const k = p.side === 't0' ? 0 : 6;
        curve = lineCurve(curveId(), lerp3(A[k], B[k], vOf(p.f)), lerp3(A[k], B[k], vOf(q.f)));
      } else if (p.side === 'f0' || p.side === 'f1') {
        curve = joined(spansBetween(p.side === 'f0' ? A : B, null, up, uq), curveId());
      } else {
        // Along the end plane: v linear in u (φ = c − θ/2π).
        const c = p.side === 'bottom' ? c0 : c1, alpha = (c - ta / (2 * Math.PI) - f0) / df, beta = -1 / (2 * df);
        curve = joined(spansBetween(A, B, up, uq, alpha, beta), curveId());
      }
      const [t0, t1] = curveDomain(curve);
      const piece: Piece = { curve, a: evaluateCurve(curve, t0) as P3, b: evaluateCurve(curve, t1) as P3, plane: p.side === 'bottom' || p.side === 'top' ? p.side : null };
      pieces.push(piece);
      if (piece.plane === 'bottom') ends.push(piece); else if (piece.plane === 'top') tops.push(piece);
    }
    // (u, v) counter-clockwise is about ∂u × ∂v, out of the rod; a nut's material is outside its bore.
    faces.push({ surface, sense: nut ? 'reversed' : 'forward', name: `${id}.thread#${++nextThread}`, loops: [{ kind: 'outer', pieces: nut ? reversed(pieces) : pieces }] });
  }
  const R = hex ? hex.across / Math.sqrt(3) : 0, corner = (k: number, z: number): P3 => [cx + R * Math.cos(Math.PI / 6 + k * Math.PI / 3), cy + R * Math.sin(Math.PI / 6 + k * Math.PI / 3), z];
  const hexLoop = (z: number): Piece[] => Array.from({ length: 6 }, (_, k) => { const a = corner(k, z), b = corner(k + 1, z); return { curve: lineCurve(curveId(), a, b), a, b, plane: null }; });
  const plane = (z: number, up: boolean, extent: number): Surface => {
    const x0 = cx - extent, x1 = cx + extent, y0 = cy - extent, y1 = cy + extent;
    // ∂u × ∂v along +Z (u along X, v along Y) or −Z (u along Y, v along X).
    const cp: P3[][] = up ? [[[x0, y0, z], [x0, y1, z]], [[x1, y0, z], [x1, y1, z]]] : [[[x0, y0, z], [x1, y0, z]], [[x0, y1, z], [x1, y1, z]]];
    return { kind: 'surface', id: `${id}_s${nextSurface++}`, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: cp, weights: [[1, 1], [1, 1]] };
  };
  const extent = Math.max(R, d) + 1;
  // A flat face: an outer loop counter-clockwise about its normal (±Z), its holes the other way.
  const flat = (name: string, z: number, up: boolean, outer: Piece[], holes: Piece[][]) => {
    faces.push({ surface: plane(z, up, extent), sense: 'forward', name, loops: [{ kind: 'outer', pieces: turned(outer, up) }, ...holes.map(h => ({ kind: 'inner' as const, pieces: turned(h, !up) }))] });
  };
  const bottomOutline = chain(ends), topOutline = chain(tops);
  if (!hex) { flat(`${id}.end`, z0, false, bottomOutline, []); flat(`${id}.top`, z1, true, topOutline, []); }
  else {
    const zl = nut ? z0 : seat, zh = nut ? z1 : seat + hex.height;
    if (nut) { flat(`${id}.bottom`, zl, false, hexLoop(zl), [bottomOutline]); flat(`${id}.top`, zh, true, hexLoop(zh), [topOutline]); }
    else { flat(`${id}.end`, z0, false, bottomOutline, []); flat(`${id}.seat`, zl, false, hexLoop(zl), [topOutline]); flat(`${id}.head`, zh, true, hexLoop(zh), []); }
    for (let k = 0; k < 6; k++) {
      const a = corner(k, zl), b = corner(k + 1, zl), c = corner(k + 1, zh), e = corner(k, zh);
      const surface: Surface = { kind: 'surface', id: `${id}_s${nextSurface++}`, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[a, e], [b, c]], weights: [[1, 1], [1, 1]] };
      const side = (p: P3, q: P3): Piece => ({ curve: lineCurve(curveId(), p, q), a: p, b: q, plane: null });
      faces.push({ surface, sense: 'forward', name: `${id}.hex${k}`, loops: [{ kind: 'outer', pieces: [side(a, b), side(b, c), side(c, e), side(e, a)] }] });
    }
  }
  return assemble(id, faces, Math.max(1, d, R));
}

/**
 * The Bézier spans of a band's rows from u = ua to ub (either way round), as pieces: a row itself (`B` null),
 * or the band along v = α + β u (quartic) between the rows A and B.
 */
function spansBetween(A: readonly P3[], B: readonly P3[] | null, ua: number, ub: number, alpha = 0, beta = 0): P3[][] {
  const lo = Math.min(ua, ub), hi = Math.max(ua, ub), out: P3[][] = [];
  for (let s = 0; s < 2; s++) {
    const s0 = s / 2, s1 = (s + 1) / 2, a = Math.max(lo, s0), b = Math.min(hi, s1);
    if (b - a <= 1e-15) continue;
    const Pc = A.slice(3 * s, 3 * s + 4), ctrl = B ? cutSpan(Pc, B.slice(3 * s, 3 * s + 4), alpha + beta * s0, alpha + beta * s1) : Pc;
    out.push(bezierPiece(ctrl, (a - s0) * 2, (b - s0) * 2));
  }
  if (ua > ub) { out.reverse(); for (const p of out) p.reverse(); }
  return out;
}
const reversed = (pieces: readonly Piece[]): Piece[] => pieces.map(p => ({ ...p, a: p.b, b: p.a })).reverse();
/** A closed loop of pieces turned to run counter-clockwise (seen from +Z) when `ccw`, else clockwise. */
function turned(loop: Piece[], ccw: boolean): Piece[] {
  let area = 0;
  for (const p of loop) {
    const [t0, t1] = curveDomain(p.curve), n = 8, fwd = sameEnd(evaluateCurve(p.curve, t0), p.a);
    for (let i = 0; i < n; i++) {
      const s = (k: number) => evaluateCurve(p.curve, fwd ? t0 + (t1 - t0) * k / n : t1 - (t1 - t0) * k / n), q = s(i), r = s(i + 1);
      area += q[0] * r[1] - r[0] * q[1];
    }
  }
  return (area > 0) === ccw ? loop : reversed(loop);
}
const sameEnd = (p: readonly number[], q: readonly number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-9 * (1 + Math.abs(q[0]) + Math.abs(q[1]) + Math.abs(q[2]));
/** End-plane pieces chained into one closed loop (end to start). */
function chain(pieces: readonly Piece[]): Piece[] {
  if (!pieces.length) throw new RangeError('a thread end has no outline');
  const left = [...pieces], loop: Piece[] = [left.shift()!];
  while (left.length) {
    const end = loop[loop.length - 1].b, k = left.findIndex(p => sameEnd(p.a, end) || sameEnd(p.b, end));
    if (k < 0) throw new RangeError('a thread end outline does not close');
    const p = left.splice(k, 1)[0]; loop.push(sameEnd(p.a, end) ? p : { ...p, a: p.b, b: p.a });
  }
  if (!sameEnd(loop[loop.length - 1].b, loop[0].a)) throw new RangeError('a thread end outline does not close');
  return loop;
}

/** The faces' pieces welded into vertices and shared edges (a piece and its neighbour's are one edge), as a B-rep. */
function assemble(id: string, drafts: readonly FaceDraft[], size: number): Brep {
  const tol = 1e-7 * size, points: P3[] = [], vertexOf = (p: P3) => {
    for (let i = 0; i < points.length; i++) if (Math.abs(points[i][0] - p[0]) <= tol && Math.abs(points[i][1] - p[1]) <= tol && Math.abs(points[i][2] - p[2]) <= tol) return i;
    points.push(p); return points.length - 1;
  };
  const edges: { id: string; curve: Curve; vertices: [string, string]; mid: P3 }[] = [], byPair = new Map<string, number[]>();
  const edgeOf = (p: Piece): { edge: string; sense: 'forward' | 'reversed' } => {
    const [t0, t1] = curveDomain(p.curve), s = vertexOf(evaluateCurve(p.curve, t0) as P3), e = vertexOf(evaluateCurve(p.curve, t1) as P3), mid = evaluateCurve(p.curve, (t0 + t1) / 2) as P3;
    const from = vertexOf(p.a), key = `${Math.min(s, e)}:${Math.max(s, e)}`, list = byPair.get(key) ?? [];
    let k = list.find(i => Math.hypot(edges[i].mid[0] - mid[0], edges[i].mid[1] - mid[1], edges[i].mid[2] - mid[2]) <= 1e3 * tol);
    if (k === undefined) { k = edges.length; edges.push({ id: `${id}_e${k}`, curve: { ...p.curve, id: `${id}_e${k}` }, vertices: [`${id}_v${s}`, `${id}_v${e}`], mid }); list.push(k); byPair.set(key, list); }
    return { edge: edges[k].id, sense: edges[k].vertices[0] === `${id}_v${from}` ? 'forward' : 'reversed' };
  };
  const faces: BrepFaceInput[] = drafts.map((f, i) => ({ id: `${id}_f${i}`, name: f.name, surface: f.surface, sense: f.sense, loops: f.loops.map(l => ({ kind: l.kind, uses: l.pieces.map(edgeOf) })) }));
  const brep = buildBrep({ source: { family: 'thread', id }, toleranceMM: 1e3 * tol, vertices: points.map((p, i) => ({ id: `${id}_v${i}`, point: p })), edges: edges.map(e => ({ id: e.id, curve: e.curve, vertices: e.vertices })), bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_shell`, faces, closed: true }] }] });
  assertValidBrep(brep);
  return brep;
}
