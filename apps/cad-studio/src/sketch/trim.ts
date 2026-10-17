// Trimming a sketch, as sketchers do to make one outline of overlapping shapes: a click on a piece of a
// line, arc or circle removes it back to where it crosses another (or the whole piece, crossing nothing);
// the shape left open is an outline with ends, and open outlines meeting end to end join — when they
// close up, into one closed outline. A rectangle and a circle across its edge become a keyhole after two
// trims: the rectangle's edge inside the circle, then the circle's arc inside the rectangle.
import type { SketchShape } from '../viewport/Viewport';
import { arcOf } from './profile';

type P2 = [number, number];
type Poly = { points: P2[]; bulges: number[]; closed: boolean };
/** A piece of an outline on t ∈ [0, 1]: a line a→b, or an arc about c from angle t0 by sw (a full circle: sw = 2π). */
type Piece = { kind: 'line'; a: P2; b: P2 } | { kind: 'arc'; c: P2; r: number; t0: number; sw: number };

const TAU = 2 * Math.PI, r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const at = (s: Piece, t: number): P2 => s.kind === 'line' ? [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t] : [s.c[0] + s.r * Math.cos(s.t0 + s.sw * t), s.c[1] + s.r * Math.sin(s.t0 + s.sw * t)];

/** A shape as an outline of points and bulges (a circle: null, it has no points). */
function polyOf(s: SketchShape): Poly | null {
  switch (s.kind) {
    case 'rectangle': return { points: [s.a, [s.b[0], s.a[1]], s.b, [s.a[0], s.b[1]]], bulges: [0, 0, 0, 0], closed: true };
    case 'circle': return null;
    case 'slot': {
      const l = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1, n: P2 = [-(s.b[1] - s.a[1]) / l * s.r, (s.b[0] - s.a[0]) / l * s.r];
      return { points: [[s.a[0] - n[0], s.a[1] - n[1]], [s.b[0] - n[0], s.b[1] - n[1]], [s.b[0] + n[0], s.b[1] + n[1]], [s.a[0] + n[0], s.a[1] + n[1]]], bulges: [0, 1, 0, 1], closed: true };
    }
    case 'polygon': return { points: s.points, bulges: s.points.map((_, i) => s.bulges?.[i] ?? 0), closed: s.closed };
  }
}
function piecesOf(s: SketchShape): Piece[] {
  if (s.kind === 'circle') return [{ kind: 'arc', c: s.c, r: s.r, t0: 0, sw: TAU }];
  const p = polyOf(s)!, n = p.points.length, out: Piece[] = [];
  for (let i = 0; i < (p.closed ? n : n - 1); i++) {
    const a = p.points[i], b = p.points[(i + 1) % n];
    if (!p.bulges[i]) { out.push({ kind: 'line', a, b }); continue; }
    const arc = arcOf(a, b, p.bulges[i]); out.push({ kind: 'arc', c: arc.center, r: arc.radius, t0: arc.start, sw: arc.sweep });
  }
  return out;
}

/** The parameter of a point on a piece (its nearest for a line; by angle for an arc, in [0, 1) for a circle). */
function paramOf(s: Piece, p: P2): number {
  if (s.kind === 'line') { const d = [s.b[0] - s.a[0], s.b[1] - s.a[1]], l2 = d[0] * d[0] + d[1] * d[1] || 1; return ((p[0] - s.a[0]) * d[0] + (p[1] - s.a[1]) * d[1]) / l2; }
  const g = (Math.atan2(p[1] - s.c[1], p[0] - s.c[0]) - s.t0) * Math.sign(s.sw), u = ((g % TAU) + TAU) % TAU / Math.abs(s.sw);
  // Past the end of an arc: the nearer reading (just before the start, or just after the end).
  return u > 1 && Math.abs(s.sw) < TAU ? (u - 1 < TAU / Math.abs(s.sw) - u ? u : u - TAU / Math.abs(s.sw)) : u;
}
function distance(s: Piece, p: P2): number {
  const t = Math.max(0, Math.min(1, paramOf(s, p))), q = at(s, t);
  return Math.hypot(q[0] - p[0], q[1] - p[1]);
}
/** Parameters on `s` where it meets `o` (both bounded). */
function crossings(s: Piece, o: Piece): number[] {
  const eps = 1e-9, pts: P2[] = [];
  const onBoth = (p: P2) => [s, o].every(x => { const t = paramOf(x, p); return t >= -eps && t <= 1 + eps; });
  if (s.kind === 'line' && o.kind === 'line') {
    const d1 = [s.b[0] - s.a[0], s.b[1] - s.a[1]], d2 = [o.b[0] - o.a[0], o.b[1] - o.a[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) > 1e-12) { const t = ((o.a[0] - s.a[0]) * d2[1] - (o.a[1] - s.a[1]) * d2[0]) / den; pts.push(at(s, t)); }
  } else if (s.kind === 'arc' && o.kind === 'arc') {
    const dx = o.c[0] - s.c[0], dy = o.c[1] - s.c[1], D = Math.hypot(dx, dy);
    if (D > 1e-12) {
      const x = (s.r * s.r - o.r * o.r + D * D) / (2 * D), h2 = s.r * s.r - x * x;
      if (h2 >= -1e-9) { const h = Math.sqrt(Math.max(0, h2)), mx = s.c[0] + x * dx / D, my = s.c[1] + x * dy / D; pts.push([mx + h * dy / D, my - h * dx / D], [mx - h * dy / D, my + h * dx / D]); }
    }
  } else {
    const L = (s.kind === 'line' ? s : o) as Extract<Piece, { kind: 'line' }>, C = (s.kind === 'arc' ? s : o) as Extract<Piece, { kind: 'arc' }>;
    const d = [L.b[0] - L.a[0], L.b[1] - L.a[1]], l = Math.hypot(d[0], d[1]) || 1, u = [d[0] / l, d[1] / l], f = [L.a[0] - C.c[0], L.a[1] - C.c[1]];
    const B = f[0] * u[0] + f[1] * u[1], disc = B * B - (f[0] * f[0] + f[1] * f[1] - C.r * C.r);
    if (disc >= -1e-9) { const q = Math.sqrt(Math.max(0, disc)); for (const k of [-B - q, -B + q]) pts.push([L.a[0] + u[0] * k, L.a[1] + u[1] * k]); }
  }
  return pts.filter(onBoth).map(p => paramOf(s, p));
}

/** The outline of piece `s` from t0 to t1 as its start point and bulge. */
const partBulge = (s: Piece, t0: number, t1: number) => s.kind === 'line' ? 0 : Math.round(Math.tan(s.sw * (t1 - t0) / 4) * 1e9) / 1e9;
const pt = (s: Piece, t: number): P2 => { const q = at(s, t); return [r6(q[0]), r6(q[1])]; };

/** The piece nearest `p` (within `tol` mm) and the part of it a trim there removes: t from lo to hi. */
interface Target { shape: number; piece: number; s: Piece; full: boolean; lo: number; hi: number; gone: boolean }
function target(shapes: SketchShape[], p: P2, tol: number): Target | null {
  let best: { shape: number; piece: number; d: number } | null = null;
  const pieces = shapes.map(piecesOf);
  pieces.forEach((ps, si) => ps.forEach((s, pi) => { const d = distance(s, p); if (d <= tol && (!best || d < best.d)) best = { shape: si, piece: pi, d }; }));
  if (!best) return null;
  const { shape: si, piece: pi } = best as { shape: number; piece: number }, s = pieces[si][pi];
  const full = s.kind === 'arc' && Math.abs(s.sw) >= TAU - 1e-12, tp = paramOf(s, p);
  const cuts = pieces.flatMap((ps, sj) => ps.flatMap((o, pj) => sj === si && pj === pi ? [] : crossings(s, o))).filter(t => full ? true : t > 1e-7 && t < 1 - 1e-7);
  if (full) {
    // A circle: crossing nothing (or once) it goes; else the arc between the crossings either side of the click.
    const ts = [...new Set(cuts.map(t => ((t % 1) + 1) % 1))].sort((a, b) => a - b);
    if (ts.length < 2) return { shape: si, piece: pi, s, full, lo: 0, hi: 1, gone: true };
    const hi = ts.find(t => t > tp) ?? ts[0] + 1, lo = [...ts].reverse().find(t => t < tp) ?? ts[ts.length - 1] - 1;
    return { shape: si, piece: pi, s, full, lo, hi, gone: false };
  }
  return { shape: si, piece: pi, s, full, lo: Math.max(0, ...cuts.filter(t => t < tp)), hi: Math.min(1, ...cuts.filter(t => t > tp)), gone: false };
}

/** The part a trim at `p` would remove, sampled (for the hover highlight), or null off the sketch. */
export function trimPreview(shapes: SketchShape[], p: P2, tol: number): P2[] | null {
  const t = target(shapes, p, tol); if (!t) return null;
  const n = t.s.kind === 'line' ? 1 : Math.max(2, Math.ceil(Math.abs(t.s.sw) * (t.hi - t.lo) / (Math.PI / 24)));
  return Array.from({ length: n + 1 }, (_, k) => pt(t.s, t.lo + (t.hi - t.lo) * k / n));
}

/**
 * The sketch's shapes with the piece nearest `p` (within `tol` mm) trimmed back to its nearest crossings
 * on either side, and open outlines meeting end to end joined; or why not.
 */
export function trimAt(shapes: SketchShape[], p: P2, tol: number): { shapes: SketchShape[] } | { error: string } {
  const T = target(shapes, p, tol);
  if (!T) return { error: 'Click on a line, arc or circle of the sketch to trim it.' };
  const { shape: si, piece: pi, s, full, lo, hi } = T, shape = shapes[si];
  const rest = shapes.filter((_, k) => k !== si);
  // What the outline's attached circles become: shapes of their own.
  const loose: SketchShape[] = shape.kind === 'polygon' && shape.circles?.length ? shape.circles.map(c => ({ kind: 'circle', c: c.c, r: c.r, ...(shape.construction ? { construction: true as const } : {}) })) : [];
  const flag = shape.construction ? { construction: true as const } : {};
  const open = (points: P2[], bulges: number[]): SketchShape => ({ kind: 'polygon', points, bulges, closed: false, ...flag });
  let made: SketchShape[];
  if (full) made = T.gone ? [] : [open([pt(s, hi), pt(s, lo + 1)], [partBulge(s, hi, lo + 1), 0])];
  else {
    const P = polyOf(shape)!, n = P.points.length;
    if (P.closed) {
      // Round from the far end of the cut to its near end: the trimmed piece's rest, then all the others.
      const pts: P2[] = [], bs: number[] = [];
      if (hi < 1) { pts.push(pt(s, hi)); bs.push(partBulge(s, hi, 1)); }
      for (let k = 1; k < n; k++) { const i = (pi + k) % n; pts.push(P.points[i]); bs.push(P.bulges[i]); }
      pts.push(P.points[pi]); bs.push(lo > 0 ? partBulge(s, 0, lo) : 0);
      if (lo > 0) { pts.push(pt(s, lo)); bs.push(0); }
      made = [open(pts, bs)];
    } else {
      made = [];
      const head: P2[] = P.points.slice(0, pi + 1), hb = P.bulges.slice(0, pi);
      if (lo > 0) { hb.push(partBulge(s, 0, lo)); head.push(pt(s, lo)); }
      if (head.length >= 2) made.push(open(head, [...hb, 0]));
      const tail: P2[] = [], tb: number[] = [];
      if (hi < 1) { tail.push(pt(s, hi)); tb.push(partBulge(s, hi, 1)); }
      for (let i = pi + 1; i < n; i++) { tail.push(P.points[i]); tb.push(i < n - 1 ? P.bulges[i] : 0); }
      if (tail.length >= 2) made.push(open(tail, tb));
    }
  }
  return { shapes: joinOpen([...rest.slice(0, si), ...made, ...rest.slice(si), ...loose]) };
}

/** Open outlines (of one kind, drawn or construction) meeting end to end joined; closed up when they meet themselves. */
export function joinOpen(shapes: SketchShape[], tol = 1e-4): SketchShape[] {
  const same = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
  type Open = Extract<SketchShape, { kind: 'polygon' }>;
  const isOpen = (s: SketchShape): s is Open => s.kind === 'polygon' && !s.closed && !s.pending && s.points.length >= 2;
  const reversed = (s: Open): Open => { const n = s.points.length, b = s.bulges ?? s.points.map(() => 0); return { ...s, points: [...s.points].reverse(), bulges: [...Array.from({ length: n - 1 }, (_, k) => -(b[n - 2 - k] ?? 0)), 0] }; };
  const out = [...shapes];
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < out.length && !changed; i++) {
      const a = out[i]; if (!isOpen(a)) continue;
      // Meeting itself: closed.
      if (a.points.length >= 3 && same(a.points[0], a.points[a.points.length - 1])) {
        const n = a.points.length - 1, b = a.bulges ?? a.points.map(() => 0);
        out[i] = { kind: 'polygon', points: a.points.slice(0, n), bulges: b.slice(0, n), closed: true, ...(a.construction ? { construction: true as const } : {}) };
        changed = true; break;
      }
      for (let j = 0; j < out.length && !changed; j++) {
        const c = out[j]; if (j === i || !isOpen(c) || !!c.construction !== !!a.construction) continue;
        const end = a.points[a.points.length - 1];
        const next = same(end, c.points[0]) ? c : same(end, c.points[c.points.length - 1]) ? reversed(c) : null;
        if (!next) continue;
        const ab = (a.bulges ?? a.points.map(() => 0)).slice(0, a.points.length - 1);
        out[i] = { ...a, points: [...a.points, ...next.points.slice(1)], bulges: [...ab, ...(next.bulges ?? next.points.map(() => 0))] };
        out.splice(j, 1); changed = true;
      }
    }
  }
  return out;
}
