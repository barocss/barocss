// Independent oracle for B1 band geometry: exact support functions of each source from its own definition (not band.ts),
// checks of a produced loop (support equality, tangency, arcs on generator circles, convex CCW simple), and helpers.
import type { LoopSegment, SketchBand } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/doc';
import type { SketchShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/types';

export type P = [number, number];
export const TAU = 2 * Math.PI;
export const nrm = (a: number) => { const t = a % TAU; return t < 0 ? t + TAU : t; };

/** Support pieces: point (r=0)/disc (full), or arc (center, R, start angle, ccw sweep). */
export interface Piece { c: P; r: number; a0?: number; sw?: number }
function arcFromBulge(p: P, q: P, b: number): Piece {
  const th = 4 * Math.atan(b), dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), n: P = [-dy / L, dx / L];
  const k = (L / 2) / Math.tan(th / 2), c: P = [(p[0] + q[0]) / 2 + n[0] * k, (p[1] + q[1]) / 2 + n[1] * k];
  const R = Math.hypot(p[0] - c[0], p[1] - c[1]);
  const ap = Math.atan2(p[1] - c[1], p[0] - c[0]), aq = Math.atan2(q[1] - c[1], q[0] - c[0]);
  // ccw from p to q if th>0, else ccw from q to p (same point set)
  return th > 0 ? { c, r: R, a0: ap, sw: nrm(aq - ap) } : { c, r: R, a0: aq, sw: nrm(ap - aq) };
}
export function piecesOf(s: SketchShape): Piece[] {
  if (s.kind === 'circle') return [{ c: s.c, r: s.r }];
  if (s.kind === 'slot') return [{ c: s.a, r: s.r }, { c: s.b, r: s.r }];
  if (s.kind === 'rectangle') return [s.a, [s.b[0], s.a[1]], s.b, [s.a[0], s.b[1]]].map(c => ({ c: c as P, r: 0 }));
  if (s.kind === 'polygon') {
    const out: Piece[] = s.points.map(c => ({ c, r: 0 }));
    s.points.forEach((p, i) => { const b = s.bulges?.[i] ?? 0; if (b) out.push(arcFromBulge(p, s.points[(i + 1) % s.points.length], b)); });
    return out;
  }
  return [];
}
export function hPiece(g: Piece, t: number): number {
  const u: P = [Math.cos(t), Math.sin(t)];
  if (g.sw === undefined) return g.c[0] * u[0] + g.c[1] * u[1] + g.r;
  if (nrm(t - g.a0!) <= g.sw) return g.c[0] * u[0] + g.c[1] * u[1] + g.r;
  const e = (a: number) => (g.c[0] + g.r * Math.cos(a)) * u[0] + (g.c[1] + g.r * Math.sin(a)) * u[1];
  return Math.max(e(g.a0!), e(g.a0! + g.sw));
}
export const hSet = (ps: Piece[], t: number) => ps.reduce((m, g) => Math.max(m, hPiece(g, t)), -Infinity);

/** The produced loop as pieces (lines: their start points; arcs: arc pieces) — its own support function. */
export function loopPieces(l: LoopSegment[]): Piece[] {
  return l.flatMap((s, i) => {
    const a = s.start as P, b = l[(i + 1) % l.length].start as P;
    if (s.kind === 'line') return [{ c: a, r: 0 }];
    const c = s.center as P, r = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]), a1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
    return [{ c: a, r: 0 }, l.length === 1 ? { c, r } : { c, r, a0, sw: s.direction === 'ccw' ? nrm(a1 - a0) : -1 }];
  });
}
export function measure(l: LoopSegment[]) {
  let per = 0, area = 0;
  l.forEach((s, i) => {
    const a = s.start as P, b = l[(i + 1) % l.length].start as P;
    area += (a[0] * b[1] - b[0] * a[1]) / 2;
    if (s.kind === 'line') { per += Math.hypot(b[0] - a[0], b[1] - a[1]); return; }
    const c = s.center as P, r = Math.hypot(a[0] - c[0], a[1] - c[1]);
    let sw = nrm(Math.atan2(b[1] - c[1], b[0] - c[0]) - Math.atan2(a[1] - c[1], a[0] - c[0]));
    if (l.length === 1) sw = TAU;
    if (s.direction === 'cw') sw = -(TAU - sw);
    per += Math.abs(r * sw); area += r * r * (sw - Math.sin(sw)) / 2;
  });
  return { per, area };
}

/** Problems with loop `l` as the hull of `srcPieces` grown by D; returns list of strings. */
export function checkLoop(l: LoopSegment[], srcPieces: Piece[][], D: number, scale: number, N = 6000): string[] {
  const bad: string[] = [], all = srcPieces.flat(), tol = 1e-8 * scale;
  if (l.length < 2) bad.push('short loop');
  const n = l.length;
  // arcs: ccw, on circles, centres = a generator, radius = gen r + D
  let turn = 0;
  const dirIn: number[] = [], dirOut: number[] = [];
  l.forEach((s, i) => {
    const a = s.start as P, b = l[(i + 1) % n].start as P;
    if (s.kind === 'arc') {
      if (s.direction !== 'ccw') bad.push(`arc ${i} not ccw`);
      const c = s.center as P, ra = Math.hypot(a[0] - c[0], a[1] - c[1]), rb = Math.hypot(b[0] - c[0], b[1] - c[1]);
      if (Math.abs(ra - rb) > 1e-9 * scale) bad.push(`arc ${i} ends off circle ${ra - rb}`);
      const gen = all.find(g => Math.hypot(g.c[0] - c[0], g.c[1] - c[1]) < 1e-9 * scale && Math.abs(g.r + D - ra) < 1e-9 * scale);
      if (!gen) bad.push(`arc ${i} centre/radius not a generator (${c} r ${ra})`);
      const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]), sw = n === 1 ? TAU : nrm(Math.atan2(b[1] - c[1], b[0] - c[0]) - a0);
      dirIn.push(a0 + Math.PI / 2); dirOut.push(a0 + sw + Math.PI / 2); turn += sw;
      // arc midpoint on the hull: support in that direction
      const tm = a0 + sw / 2, hm = hSet(all, tm) + D, xm = c[0] * Math.cos(tm) + c[1] * Math.sin(tm) + ra;
      if (Math.abs(hm - xm) > tol) bad.push(`arc ${i} midpoint not on hull ${hm - xm}`);
    } else {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if (L < 1e-4) bad.push(`line ${i} short ${L}`);
      const t = Math.atan2(dy, dx); dirIn.push(t); dirOut.push(t);
      const nt = t - Math.PI / 2, h = hSet(all, nt) + D, ea = a[0] * Math.cos(nt) + a[1] * Math.sin(nt), eb = b[0] * Math.cos(nt) + b[1] * Math.sin(nt);
      if (Math.abs(h - ea) > tol || Math.abs(h - eb) > tol) bad.push(`line ${i} not a supporting line (${h - ea}, ${h - eb})`);
    }
  });
  if (n > 1) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, d = dirIn[j] - dirOut[i], tr = Math.atan2(Math.sin(d), Math.cos(d));
    if (tr < -1e-7) bad.push(`joint ${j} turns right ${tr}`);
    // tangency at arc-line joints when D>0 (G1)
    if (D > 0 && (l[i].kind === 'arc' || l[j].kind === 'arc') && Math.abs(tr) > 1e-6) bad.push(`joint ${j} not tangent ${tr}`);
    turn += tr;
  }
  if (Math.abs(turn - TAU) > 1e-6) bad.push(`total turn ${turn}`);
  const lp = loopPieces(l);
  let worst = 0;
  for (let k = 0; k < N; k++) { const t = (k + 0.37) * TAU / N, e = Math.abs(hSet(lp, t) - (hSet(all, t) + D)); worst = Math.max(worst, e); }
  if (worst > 1e-6 * scale) bad.push(`support mismatch ${worst}`);
  if (measure(l).area <= 0) bad.push('not ccw');
  return bad;
}

// ---- random sources ----
export function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function randomShape(R: () => number, c: P, size: number): SketchShape {
  const k = Math.floor(R() * 6), rot = R() * TAU, rotp = (p: P): P => [c[0] + p[0] * Math.cos(rot) - p[1] * Math.sin(rot), c[1] + p[0] * Math.sin(rot) + p[1] * Math.cos(rot)];
  if (k === 0) return { kind: 'circle', c, r: size, construction: true };
  if (k === 1) { const w = size * (0.3 + R()), h = size * (0.3 + R()); return { kind: 'rectangle', a: [c[0] - w, c[1] - h], b: [c[0] + w, c[1] + h], construction: true }; }
  if (k === 2) { const L = size * R(), r = size * (0.2 + 0.6 * R()); return { kind: 'slot', a: rotp([-L / 2, 0]), b: rotp([L / 2, 0]), r, construction: true }; }
  // convex polygon on a circle, maybe bulged, maybe CW, maybe rotated rectangle
  const m = k === 3 ? 4 : 3 + Math.floor(R() * 6);
  let ang = k === 3 ? [0.6, Math.PI - 0.6, Math.PI + 0.6, TAU - 0.6] : Array.from({ length: m }, () => R() * TAU).sort((a, b) => a - b);
  ang = ang.filter((a, i) => i === 0 || a - ang[i - 1] > 0.15);
  if (ang.length < 3 || TAU - ang[ang.length - 1] + ang[0] < 0.15) return { kind: 'circle', c, r: size, construction: true };
  const pts = ang.map(a => rotp([size * Math.cos(a), size * Math.sin(a)]));
  const bul = ang.map((a, i) => { const span = (i + 1 < ang.length ? ang[i + 1] : ang[0] + TAU) - a; return k === 5 && R() < 0.6 ? Math.tan(span * (R() < 0.3 ? 1 : R()) / 4) : 0; });
  if (R() < 0.4) { // CW
    const n = pts.length, rp = [...pts].reverse(), rb = rp.map((_, j) => -bul[(n - 2 - j + n) % n]);
    return { kind: 'polygon', points: rp, closed: true, bulges: rb, construction: true };
  }
  return { kind: 'polygon', points: pts, closed: true, bulges: bul, construction: true };
}
export const bandOver = (all: SketchShape[], ix: number[], extra: Partial<SketchBand> = {}): SketchBand => ({ version: 1, id: 'b1', sources: ix.map(i => all[i].ids![0]), ...extra });
