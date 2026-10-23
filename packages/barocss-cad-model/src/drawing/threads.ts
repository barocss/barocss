// Cosmetic threads on the drawing, as ISO 6410 draws them: an external thread's root (minor diameter) as
// thin lines along it and, seen end on, a thin three-quarter circle; an internal thread's crest (major
// diameter) the same way round its tap drill — hidden lines along a bore seen from the side. From the
// round edges of the threaded faces (a tapped hole's, a bolt's shank, a nut's bore): their circles give
// the axis, the face's radius and how far along the thread runs.
import type { BrepProjection } from '@barocss/cad';
import type { FaceThread } from '../app/threads';
import type { Mark } from './sheet';
import { toSheet, type ViewPlacement } from './views';
import type { XY } from './types';
import { r6Signed as r6 } from '../util/round';

/** ISO 68-1: the minor diameter of an external thread, d − 1.226869 P. */
export const minorDiameter = (d: number, pitch: number) => Math.round((d - 1.226869 * pitch) * 1000) / 1000;

export function threadMarks(v: ViewPlacement, pr: BrepProjection, threads: ReadonlyMap<string, FaceThread>, showHidden: boolean): Mark[] {
  if (!threads.size) return [];
  const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const P = (p: readonly number[]): XY => [dot(p, pr.right), dot(p, pr.up)];
  // The threaded faces' rims, by axis: the circles along it and whether any of their ink is visible.
  const axes = new Map<string, { t: FaceThread; dir: readonly number[]; centres: (readonly number[])[]; radius: number; visible: boolean }>();
  for (const e of pr.edges) {
    const c = e.circle; if (!c) continue;
    const t = [...e.name.matchAll(/\b(n\d+)\.side/g)].map(m => threads.get(m[1])).find(x => x && (x.radius === undefined || Math.abs(x.radius - c.radius) < 0.01 * x.radius + 1e-3));
    if (!t) continue;
    const n = c.normal[0] < 0 || (c.normal[0] === 0 && (c.normal[1] < 0 || (c.normal[1] === 0 && c.normal[2] < 0))) ? c.normal.map(x => -x) : [...c.normal];
    // (The axis line: its direction and the centre's offset across it.)
    const s = dot(c.center, n), foot = c.center.map((x, k) => x - n[k] * s), key = [...n, ...foot, c.radius].map(r6).join(',');
    const a = axes.get(key) ?? { t, dir: n, centres: [], radius: c.radius, visible: false };
    a.centres.push(c.center); a.visible ||= e.pieces.some(p => p.visible); axes.set(key, a);
  }
  const marks: Mark[] = [];
  for (const { t, dir, centres, radius, visible } of axes.values()) {
    // The thread's line: the root of an external thread, the crest round a bore.
    const r = t.internal ? t.d / 2 : Math.min(radius, minorDiameter(t.d, t.pitch) / 2);
    const end = Math.abs(dot(dir, pr.toward));
    if (end > 1 - 1e-6) {
      // Seen end on: three quarters of a circle, open at the upper right.
      const c = toSheet(v, P(centres[0])), R = r * v.scale;
      marks.push({ kind: 'arc', center: c, u: [R, 0], v: [0, R], t0: 0, t1: 1.5 * Math.PI, pen: 'thin' });
      continue;
    }
    if (end > 1e-6) continue; // (an oblique view: none)
    const along = centres.map(c => dot(c, dir)), lo = Math.min(...along), hi = Math.max(...along);
    if (hi - lo < 1e-9) continue;
    const pen = t.internal || !visible ? 'hidden' : 'thin';
    if (pen === 'hidden' && !showHidden) continue;
    const base = centres[along.indexOf(lo)], d2 = P(dir), l = Math.hypot(d2[0], d2[1]), u: XY = [d2[0] / l, d2[1] / l], across: XY = [-u[1], u[0]], b = P(base);
    for (const side of [-1, 1]) {
      const at = (s: number): XY => [b[0] + u[0] * s + across[0] * side * r, b[1] + u[1] * s + across[1] * side * r];
      marks.push({ kind: 'line', a: toSheet(v, at(0)), b: toSheet(v, at(hi - lo)), pen });
    }
  }
  return marks;
}
