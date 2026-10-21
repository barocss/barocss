// Trimming a sketch, as sketchers do to make one outline of overlapping shapes: a click on a piece of a
// line, arc or circle removes it back to where it crosses another (or the whole piece, crossing nothing);
// the shape left open is an outline with ends, and open outlines meeting end to end join — when they
// close up, into one closed outline. A rectangle and a circle across its edge become a keyhole after two
// trims: the rectangle's edge inside the circle, then the circle's arc inside the rectangle.
import type { SketchShape } from './types';
import { arcOf } from '@barocss/cad-model/sketch/profile';
import { carryPolygon, inheritIds, nextIdOf, withIds } from './entityIds';

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
  // (The pieces left keep their sides' ids by where they start, R10a.)
  return { shapes: inheritIds(shapes, joinOpen([...rest.slice(0, si), ...made, ...rest.slice(si), ...loose])) };
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

/**
 * Extending: the open end of a line or arc nearest `p` (an end piece of an open outline, within `tol`)
 * run on — a line straight on, an arc round its circle — to the first piece of the sketch it meets.
 */
interface Reach { shape: number; atEnd: boolean; s: Piece; ext: Piece; t: number }
function reach(shapes: SketchShape[], p: P2, tol: number): Reach | { error: string } {
  const pieces = shapes.map(piecesOf);
  let best: { shape: number; atEnd: boolean; d: number } | null = null;
  shapes.forEach((sh, si) => {
    if (sh.kind !== 'polygon' || sh.closed || sh.points.length < 2) return;
    const ps = pieces[si];
    for (const [atEnd, piece] of [[false, ps[0]], [true, ps[ps.length - 1]]] as const) {
      const d = distance(piece, p); if (d > tol) continue;
      // (A one-piece line: the end nearer the click.)
      const t = paramOf(piece, p), end = ps.length === 1 ? t > 0.5 : atEnd;
      if (ps.length === 1 && end !== atEnd) continue;
      if (!best || d < best.d) best = { shape: si, atEnd: end, d };
    }
  });
  if (!best) return { error: 'Click near the open end of a line or arc to extend it.' };
  const { shape: si, atEnd } = best as { shape: number; atEnd: boolean }, ps = pieces[si], s = atEnd ? ps[ps.length - 1] : ps[0];
  // The run past the end, as a piece of its own from the end outwards.
  const size = Math.max(1, ...shapes.flatMap(piecesOf).flatMap(x => x.kind === 'line' ? [...x.a, ...x.b].map(Math.abs) : [Math.abs(x.c[0]) + x.r, Math.abs(x.c[1]) + x.r]));
  let ext: Piece;
  if (s.kind === 'line') {
    const from = atEnd ? s.b : s.a, d = atEnd ? [s.b[0] - s.a[0], s.b[1] - s.a[1]] : [s.a[0] - s.b[0], s.a[1] - s.b[1]], l = Math.hypot(d[0], d[1]) || 1, L = 40 * size;
    ext = { kind: 'line', a: from, b: [from[0] + d[0] / l * L, from[1] + d[1] / l * L] };
  } else {
    const rest = TAU - Math.abs(s.sw) - 1e-6, sg = Math.sign(s.sw);
    ext = atEnd ? { kind: 'arc', c: s.c, r: s.r, t0: s.t0 + s.sw, sw: sg * rest } : { kind: 'arc', c: s.c, r: s.r, t0: s.t0, sw: -sg * rest };
  }
  const ts = pieces.flatMap((qs, sj) => qs.flatMap((o, pj) => {
    // (Not the piece being extended, nor — for its own outline — the piece it leaves from.)
    if (sj === si && (pj === (atEnd ? qs.length - 1 : 0))) return [];
    return crossings(ext, o);
  })).filter(t => t > 1e-7);
  if (!ts.length) return { error: 'Nothing lies ahead of that end to extend it to.' };
  return { shape: si, atEnd, s, ext, t: Math.min(...ts) };
}
export function extendPreview(shapes: SketchShape[], p: P2, tol: number): P2[] | null {
  const r = reach(shapes, p, tol); if ('error' in r) return null;
  const n = r.ext.kind === 'line' ? 1 : Math.max(2, Math.ceil(Math.abs(r.ext.sw) * r.t / (Math.PI / 24)));
  return Array.from({ length: n + 1 }, (_, k) => pt(r.ext, r.t * k / n));
}
export function extendAt(shapes: SketchShape[], p: P2, tol: number): { shapes: SketchShape[] } | { error: string } {
  const r = reach(shapes, p, tol); if ('error' in r) return r;
  const sh = shapes[r.shape] as Extract<SketchShape, { kind: 'polygon' }>, n = sh.points.length, end = pt(r.ext, r.t);
  const bulges = sh.points.map((_, i) => sh.bulges?.[i] ?? 0);
  // A line's end moves along it (its bulge stays 0); an arc's end moves round its circle (its bulge grows).
  const arcBulge = (s: Extract<Piece, { kind: 'arc' }>, extra: number) => Math.round(Math.tan((s.sw + Math.sign(s.sw) * extra) / 4) * 1e9) / 1e9;
  let points = [...sh.points];
  if (r.atEnd) { points[n - 1] = end; if (r.s.kind === 'arc') bulges[n - 2] = arcBulge(r.s, Math.abs((r.ext as Extract<Piece, { kind: 'arc' }>).sw) * r.t); }
  else { points = [end, ...points.slice(1)]; if (r.s.kind === 'arc') bulges[0] = arcBulge(r.s, Math.abs((r.ext as Extract<Piece, { kind: 'arc' }>).sw) * r.t); }
  // (Kept edge lengths and the like no longer hold.)
  const next: SketchShape = { kind: 'polygon', points, bulges, closed: false, ...(sh.construction ? { construction: true as const } : {}) };
  return { shapes: inheritIds(shapes, joinOpen(shapes.map((x, i) => i === r.shape ? next : x))) };
}

/** Splitting: the piece nearest `p` (within `tol`) gets a point there — two pieces where it was one. */
function splitTarget(shapes: SketchShape[], p: P2, tol: number) {
  let best: { shape: number; piece: number; d: number } | null = null;
  shapes.map(piecesOf).forEach((ps, si) => ps.forEach((s, pi) => { const d = distance(s, p); if (d <= tol && (!best || d < best.d)) best = { shape: si, piece: pi, d }; }));
  if (!best) return null;
  const b = best as { shape: number; piece: number }, s = piecesOf(shapes[b.shape])[b.piece], t = Math.max(0, Math.min(1, paramOf(s, p)));
  return { ...b, s, t };
}
export function splitPreview(shapes: SketchShape[], p: P2, tol: number): P2 | null {
  const t = splitTarget(shapes, p, tol); return t ? pt(t.s, t.t) : null;
}
export function splitAt(input: SketchShape[], p: P2, tol: number): { shapes: SketchShape[] } | { error: string } {
  // (Every side with its id first: the split keeps them, R10a.)
  const shapes = withIds(input);
  const T = splitTarget(shapes, p, tol);
  if (!T) return { error: 'Click on a line, arc or circle of the sketch to split it there.' };
  const { shape: si, piece: pi, s, t } = T, shape = shapes[si], flag = shape.construction ? { construction: true as const } : {}, fresh = `e${nextIdOf(shapes)}`;
  const at2 = pt(s, t);
  if (shape.kind === 'circle') {
    // A circle: two half circles meeting at the point and opposite it (the first keeps the circle's id).
    const opp: P2 = [r6(2 * shape.c[0] - at2[0]), r6(2 * shape.c[1] - at2[1])];
    return { shapes: shapes.map((x, i) => i === si ? { kind: 'polygon', points: [at2, opp], bulges: [1, 1], closed: true, ids: [shape.ids![0], fresh], ...flag } : x) };
  }
  if (t < 1e-6 || t > 1 - 1e-6) return { error: 'That is already a point of the outline: split a piece away from its ends.' };
  const P = polyOf(shape)!, points = [...P.points], bulges = [...P.bulges], ids = [...shape.ids!];
  // The piece's first part keeps its id; the second, from the new point, has a new one. Every other side keeps its id,
  // and an outline's constraints and dimensions on them stay (the split piece's own length or radius goes).
  points.splice(pi + 1, 0, at2); bulges.splice(pi, 1, partBulge(s, 0, t), partBulge(s, t, 1)); ids.splice(pi + 1, 0, fresh);
  let next: SketchShape = { kind: 'polygon', points, bulges, closed: P.closed, ids, ...flag };
  if (shape.kind === 'polygon') next = carryPolygon(shape, next, points.map((_, j) => j <= pi ? j : j === pi + 1 ? -1 : j - 1));
  return { shapes: shapes.map((x, i) => i === si ? next : x) };
}
