// Centre marks and centrelines: a cross on every whole circle (a hole, a boss) that shows round in the
// view, and a line along the axis of every whole circle seen edge-on (a hole from the side), each
// reaching a little past the feature. Circles are grouped by their axis, so a hole's two rims give one
// mark; arcs that are not a whole turn together (a fillet's corner) get none.
import type { BrepProjection } from '@barocss/cad';
import type { Mark } from './sheet';
import { toSheet, type ViewPlacement } from './views';
import type { XY } from './types';

/** How far past the feature a centre mark or centreline reaches (sheet mm). */
const PAST = 2.5;

export function centreMarks(v: ViewPlacement, pr: BrepProjection): Mark[] {
  const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const P = (p: readonly number[]): XY => [dot(p, pr.right), dot(p, pr.up)];
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
  // Whole circles: the arcs of one circle (centre, radius, plane) together a full turn.
  const turns = new Map<string, { center: readonly number[]; radius: number; normal: readonly number[]; sweep: number }>();
  for (const e of pr.edges) {
    const c = e.circle; if (!c) continue;
    const n = c.normal[0] < 0 || (c.normal[0] === 0 && (c.normal[1] < 0 || (c.normal[1] === 0 && c.normal[2] < 0))) ? c.normal.map(x => -x) : [...c.normal];
    const key = [...c.center, c.radius, ...n].map(r6).join(',');
    const t = turns.get(key) ?? { center: c.center, radius: c.radius, normal: n, sweep: 0 };
    t.sweep += c.sweep; turns.set(key, t);
  }
  const whole = [...turns.values()].filter(t => t.sweep >= 2 * Math.PI - 1e-6);
  const marks: Mark[] = [];
  // Seen round: one cross per centre, as wide as its largest circle.
  const crosses = new Map<string, { at: XY; r: number }>();
  for (const t of whole) {
    if (Math.abs(dot(t.normal, pr.toward)) < 1 - 1e-6) continue;
    const at = P(t.center), key = at.map(r6).join(','), have = crosses.get(key);
    if (!have || have.r < t.radius) crosses.set(key, { at, r: t.radius });
  }
  for (const { at, r } of crosses.values()) {
    const c = toSheet(v, at), R = r * v.scale + PAST;
    marks.push({ kind: 'line', a: [c[0] - R, c[1]], b: [c[0] + R, c[1]], pen: 'center' }, { kind: 'line', a: [c[0], c[1] - R], b: [c[0], c[1] + R], pen: 'center' });
  }
  // Seen edge-on: one centreline per axis, spanning its circles' centres.
  const axes = new Map<string, { dir: XY; off: number; lo: number; hi: number }>();
  for (const t of whole) {
    if (Math.abs(dot(t.normal, pr.toward)) > 1e-6) continue;
    let d = P(t.normal); const l = Math.hypot(d[0], d[1]); if (l < 1e-9) continue;
    d = [d[0] / l, d[1] / l]; if (d[0] < -1e-9 || (Math.abs(d[0]) <= 1e-9 && d[1] < 0)) d = [-d[0], -d[1]];
    const c = P(t.center), off = c[0] * -d[1] + c[1] * d[0], along = c[0] * d[0] + c[1] * d[1];
    const key = [d[0], d[1], off].map(r6).join(','), a = axes.get(key);
    if (a) { a.lo = Math.min(a.lo, along); a.hi = Math.max(a.hi, along); } else axes.set(key, { dir: d, off, lo: along, hi: along });
  }
  for (const { dir, off, lo, hi } of axes.values()) {
    if (hi - lo < 1e-9) continue; // a single circle edge-on: no length to show
    const n: XY = [-dir[1], dir[0]], at = (s: number): XY => [n[0] * off + dir[0] * s, n[1] * off + dir[1] * s], k = PAST / v.scale;
    marks.push({ kind: 'line', a: toSheet(v, at(lo - k)), b: toSheet(v, at(hi + k)), pen: 'center' });
  }
  return marks;
}
