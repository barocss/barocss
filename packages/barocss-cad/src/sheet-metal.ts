import type { Point } from './types.js';
import type { ProfileSegmentInput, XY } from './extruded-profile-solid.js';

// R12 sheet metal (D115, D116). A sheet is T thick; a bend is a piece of a cylinder of inner radius R turned θ, its
// neutral layer at R + K·T (K the K-factor, defined by the bend allowance below). These are the closed forms; real K
// values come from a shop's bend tests and are never built in (D115's data rules).

/** The developed length of a bend, θ (radians) at the neutral radius: BA = θ(R + K·T). */
export const bendAllowance = (angle: number, radius: number, thickness: number, kFactor: number): number => angle * (radius + kFactor * thickness);
/** The outside setback, from a bend's tangent line to its outer virtual sharp: OSSB = (R + T)·tan(θ/2) (θ < π). */
export const outsideSetback = (angle: number, radius: number, thickness: number): number => (radius + thickness) * Math.tan(angle / 2);
/** The bend deduction: BD = 2·OSSB − BA (the outside dimensions to the virtual sharps less BD is the flat length). */
export const bendDeduction = (angle: number, radius: number, thickness: number, kFactor: number): number => 2 * outsideSetback(angle, radius, thickness) - bendAllowance(angle, radius, thickness, kFactor);

/** One bend as built: its faces, inner radius, angle, axis and its allowance, setback and deduction. */
export interface SheetBendReport {
  /** `<feature>.bend<k>`, k the path's vertex it rounds. */
  readonly name: string;
  /** Its concave face (radius R) and its convex face (radius R + T). */
  readonly inner: string; readonly outer: string;
  readonly radiusMM: number; readonly angleDegrees: number;
  /** The bend's axis, through its centre along the sheet's width. */
  readonly axis: { readonly origin: Point; readonly direction: Point };
  readonly allowanceMM: number; readonly setbackMM: number; readonly deductionMM: number;
}
/** A sheet-metal body's rules and bends (R12.1, D116). */
export interface SheetReport {
  readonly thicknessMM: number; readonly bendRadiusMM: number; readonly kFactor: number;
  readonly bends: readonly SheetBendReport[];
}

/** A sheet-metal refusal: the part model's code, the message starting with its own `[CODE]`. */
export class SheetMetalError extends Error {
  constructor(readonly code: 'PARAMETER' | 'GEOMETRY', detail: string) { super(detail.slice(0, 1024)); this.name = 'SheetMetalError'; }
}

/** A bend of the section: its centre, signed turn (radians, + to the left) and its two faces' names. */
export interface ContourBend { readonly vertex: number; readonly center: XY; readonly angle: number; readonly inner: string; readonly outer: string }
/** A contour flange's section: one closed loop of lines and arcs, a name for each of its segments, its bends. */
export interface ContourSection { readonly segments: readonly ProfileSegmentInput[]; readonly names: readonly string[]; readonly bends: readonly ContourBend[] }

/** Turns within this of 0 or 180° are refused (no bend; a fold back is a hem, not in R12). */
const ANGLE_EPS = 1e-9;
/** A leg's straight part shorter than this is refused: its bends do not fit (R12.1 makes no leg of length 0). */
const MIN_LEG_MM = 1e-6;

/**
 * The section of a contour flange: the open `path` (its corners the reference skin's virtual sharps) is one skin of the
 * sheet, the material T thick to its `side` (left or right, looking along it), a bend at every corner — the radius on
 * the path's skin R where the material lies outside the turn, R + T where it lies inside it, so the inner radius is R
 * either way. Faces: `<id>.leg<i>.a` (on the path) and `.b` (the other skin), `<id>.bend<k>.inner` / `.outer`,
 * `<id>.start` and `<id>.end` (the thickness at the path's ends). Refused by name: a turn of 0 or 180°
 * (`BEND_ANGLE`), a leg too short for its bends (`BEND_DOES_NOT_FIT`), a section crossing or touching itself
 * (`SHEET_CROSSES_ITSELF`).
 */
export function contourFlangeSection(path: readonly XY[], side: 'left' | 'right', thickness: number, radius: number, id: string): ContourSection {
  const n = path.length - 1, s = side === 'left' ? 1 : -1, T = thickness;
  const d: XY[] = [], L: number[] = [];
  for (let i = 0; i < n; i++) {
    const dx = path[i + 1][0] - path[i][0], dy = path[i + 1][1] - path[i][1], l = Math.hypot(dx, dy);
    if (!(l > MIN_LEG_MM)) throw new SheetMetalError('PARAMETER', `[BEND_DOES_NOT_FIT] path points ${i} and ${i + 1} coincide`);
    d.push([dx / l, dy / l]); L.push(l);
  }
  // Each corner k (1 … n − 1): its signed turn θ, the radius on the path's skin, its setback along both legs.
  const turn: number[] = [0], rPath: number[] = [0], back: number[] = [0];
  for (let k = 1; k < n; k++) {
    const a = d[k - 1], b = d[k], th = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
    if (Math.abs(th) < ANGLE_EPS) throw new SheetMetalError('PARAMETER', `[BEND_ANGLE] path point ${k} is in line with its neighbours: no bend there`);
    if (Math.PI - Math.abs(th) < ANGLE_EPS) throw new SheetMetalError('PARAMETER', `[BEND_ANGLE] path point ${k} turns back 180°: a fold back (a hem) is not supported yet`);
    const r = Math.sign(th) === s ? radius + T : radius;
    turn.push(th); rPath.push(r); back.push(r * Math.tan(Math.abs(th) / 2));
  }
  turn.push(0); rPath.push(0); back.push(0);
  // Each leg's straight part on the path's skin, from its start S to its end E.
  const S: XY[] = [], E: XY[] = [], m: XY[] = [];
  for (let i = 0; i < n; i++) {
    const free = L[i] - back[i] - back[i + 1];
    if (!(free > MIN_LEG_MM)) throw new SheetMetalError('PARAMETER', `[BEND_DOES_NOT_FIT] leg ${i} is ${fmt(L[i])} mm between its corners; its bends take ${fmt(back[i] + back[i + 1])} mm of it`);
    S.push([path[i][0] + back[i] * d[i][0], path[i][1] + back[i] * d[i][1]]);
    E.push([path[i + 1][0] - back[i + 1] * d[i][0], path[i + 1][1] - back[i + 1] * d[i][1]]);
    m.push([-s * d[i][1], s * d[i][0]]);
  }
  const segments: ProfileSegmentInput[] = [], names: string[] = [], bends: ContourBend[] = [], centers: XY[] = [[0, 0]];
  for (let k = 1; k < n; k++) {
    const sg = Math.sign(turn[k]);
    centers.push([E[k - 1][0] - sg * rPath[k] * d[k - 1][1], E[k - 1][1] + sg * rPath[k] * d[k - 1][0]]);
    bends.push({ vertex: k, center: centers[k], angle: turn[k], inner: `${id}.bend${k}.inner`, outer: `${id}.bend${k}.outer` });
  }
  for (let i = 0; i < n; i++) {
    segments.push({ kind: 'line', start: S[i] }); names.push(`${id}.leg${i}.a`);
    if (i < n - 1) {
      const k = i + 1, sg = Math.sign(turn[k]);
      // (The material inside the turn: the path's skin is the bend's outer face.)
      segments.push({ kind: 'arc', start: E[i], center: centers[k], direction: sg > 0 ? 'ccw' : 'cw' }); names.push(sg === s ? bends[i].outer : bends[i].inner);
    }
  }
  segments.push({ kind: 'line', start: E[n - 1] }); names.push(`${id}.end`);
  for (let i = n - 1; i >= 0; i--) {
    segments.push({ kind: 'line', start: offset(E[i], m[i], T) }); names.push(`${id}.leg${i}.b`);
    if (i > 0) {
      const sg = Math.sign(turn[i]);
      segments.push({ kind: 'arc', start: offset(S[i], m[i], T), center: centers[i], direction: sg > 0 ? 'cw' : 'ccw' }); names.push(sg === s ? bends[i - 1].inner : bends[i - 1].outer);
    }
  }
  segments.push({ kind: 'line', start: offset(S[0], m[0], T) }); names.push(`${id}.start`);
  const crossing = selfContact(segments);
  if (crossing) throw new SheetMetalError('GEOMETRY', `[SHEET_CROSSES_ITSELF] the sheet's section meets itself: ${names[crossing[0]].slice(id.length + 1)} and ${names[crossing[1]].slice(id.length + 1)} near (${fmt(crossing[2][0])}, ${fmt(crossing[2][1])})`);
  return { segments, names, bends };
}

const fmt = (x: number) => String(+x.toFixed(6));
const offset = (p: XY, m: XY, t: number): XY => [p[0] + t * m[0], p[1] + t * m[1]];

// ---- the section's self-contact test -----------------------------------------------------------------------------------
/** A segment as a line from a to b, or an arc about c of radius r from angle a0 turning `sweep` (signed). */
type Seg = { line: true; a: XY; b: XY } | { line: false; c: XY; r: number; a0: number; sweep: number; a: XY; b: XY };
function segsOf(loop: readonly ProfileSegmentInput[]): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < loop.length; i++) {
    const s = loop[i], b = loop[(i + 1) % loop.length].start;
    if (s.kind === 'line') { out.push({ line: true, a: s.start, b }); continue; }
    const c = s.center, r = Math.hypot(s.start[0] - c[0], s.start[1] - c[1]), a0 = Math.atan2(s.start[1] - c[1], s.start[0] - c[0]), a1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
    let sweep = a1 - a0;
    if (s.direction === 'ccw') { while (sweep <= 0) sweep += 2 * Math.PI; } else { while (sweep >= 0) sweep -= 2 * Math.PI; }
    out.push({ line: false, c, r, a0, sweep, a: s.start, b });
  }
  return out;
}
/** Whether angle t lies on the arc (within `eps` radians of it). */
function onArc(g: Extract<Seg, { line: false }>, t: number, eps: number): boolean {
  let u = (t - g.a0) * Math.sign(g.sweep);
  u = ((u % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return u <= Math.abs(g.sweep) + eps || u >= 2 * Math.PI - eps;
}
/** The points where two segments meet (closed forms: line–line, line–circle, circle–circle), within `tol`. */
function meet(p: Seg, q: Seg, tol: number): XY | null {
  if (p.line && q.line) return lineLine(p, q, tol);
  if (p.line && !q.line) return lineArc(p, q, tol);
  if (!p.line && q.line) return lineArc(q, p, tol);
  return arcArc(p as Extract<Seg, { line: false }>, q as Extract<Seg, { line: false }>, tol);
}
function lineLine(p: Seg, q: Seg, tol: number): XY | null {
  const rx = p.b[0] - p.a[0], ry = p.b[1] - p.a[1], sx = q.b[0] - q.a[0], sy = q.b[1] - q.a[1], den = rx * sy - ry * sx, lp = Math.hypot(rx, ry), lq = Math.hypot(sx, sy);
  const qx = q.a[0] - p.a[0], qy = q.a[1] - p.a[1];
  if (Math.abs(den) <= 1e-12 * lp * lq) {
    // Parallel: they meet only if collinear and overlapping (or touching).
    if (Math.abs(qx * ry - qy * rx) / lp > tol) return null;
    const t0 = (qx * rx + qy * ry) / (lp * lp), t1 = ((q.b[0] - p.a[0]) * rx + (q.b[1] - p.a[1]) * ry) / (lp * lp), lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(1, Math.max(t0, t1));
    return hi >= lo - tol / lp ? [p.a[0] + rx * lo, p.a[1] + ry * lo] : null;
  }
  const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
  return t >= -tol / lp && t <= 1 + tol / lp && u >= -tol / lq && u <= 1 + tol / lq ? [p.a[0] + rx * t, p.a[1] + ry * t] : null;
}
function lineArc(p: Seg, g: Extract<Seg, { line: false }>, tol: number): XY | null {
  const rx = p.b[0] - p.a[0], ry = p.b[1] - p.a[1], l = Math.hypot(rx, ry), ux = rx / l, uy = ry / l, fx = p.a[0] - g.c[0], fy = p.a[1] - g.c[1];
  const along = -(fx * ux + fy * uy), dist2 = (fx + along * ux) ** 2 + (fy + along * uy) ** 2, h2 = g.r * g.r - dist2;
  if (h2 < -2 * g.r * tol) return null;
  const h = Math.sqrt(Math.max(0, h2));
  for (const t of [along - h, along + h]) {
    if (t < -tol || t > l + tol) continue;
    const x = p.a[0] + ux * t, y = p.a[1] + uy * t;
    if (onArc(g, Math.atan2(y - g.c[1], x - g.c[0]), tol / g.r)) return [x, y];
  }
  return null;
}
function arcArc(g: Extract<Seg, { line: false }>, k: Extract<Seg, { line: false }>, tol: number): XY | null {
  const dx = k.c[0] - g.c[0], dy = k.c[1] - g.c[1], D = Math.hypot(dx, dy);
  if (D <= tol) {
    // Concentric: they meet only on one circle, where their angles overlap.
    if (Math.abs(g.r - k.r) > tol) return null;
    for (const t of [k.a0, k.a0 + k.sweep]) if (onArc(g, t, tol / g.r)) return [g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t)];
    for (const t of [g.a0, g.a0 + g.sweep]) if (onArc(k, t, tol / k.r)) return [g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t)];
    return null;
  }
  if (D > g.r + k.r + tol || D < Math.abs(g.r - k.r) - tol) return null;
  const a = (g.r * g.r - k.r * k.r + D * D) / (2 * D), h = Math.sqrt(Math.max(0, g.r * g.r - a * a)), mx = g.c[0] + a * dx / D, my = g.c[1] + a * dy / D;
  for (const sg of [-1, 1]) {
    const x = mx - sg * h * dy / D, y = my + sg * h * dx / D;
    if (onArc(g, Math.atan2(y - g.c[1], x - g.c[0]), tol / g.r) && onArc(k, Math.atan2(y - k.c[1], x - k.c[0]), tol / k.r)) return [x, y];
  }
  return null;
}
/** The first two segments of a closed loop that are not neighbours and meet (or touch), with the point; else null. */
function selfContact(loop: readonly ProfileSegmentInput[]): [number, number, XY] | null {
  const segs = segsOf(loop), N = segs.length;
  let scale = 1;
  for (const s of loop) scale = Math.max(scale, Math.abs(s.start[0]), Math.abs(s.start[1]));
  const tol = 1e-9 * scale;
  for (let i = 0; i < N; i++) for (let j = i + 2; j < N; j++) {
    if (i === 0 && j === N - 1) continue;
    const at = meet(segs[i], segs[j], tol);
    if (at) return [i, j, at];
  }
  return null;
}
