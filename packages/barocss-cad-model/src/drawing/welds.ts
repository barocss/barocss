// FRd2 (O119): weld symbols in the drawing's views — our own glyphs built from each joint's geometry, no standard's text:
// an arrow on a seam edge (an edge of the joint's end face, found by its persistent name in the view, so it follows the
// part as it changes), a leader to a knee just outside the view, a reference line with the weld's mark on it (a fillet a
// small right triangle, a butt weld two short bars), the size before the mark, a ring at the knee where it goes all
// round, a second ring where the bore is welded too, and the joint's W-number at the line's end (the weld list's).
// Each joint is shown once, in the first view (front, top, right) where an edge of its end face is visible; a joint seen
// in none is said (`unshown`). The knees along each side of a view are kept KNEE_GAP apart.
import type { WeldJoint } from '../frames/welds';
import { inView } from './dimensions';
import type { Mark, MarkGroup } from './sheet';
import { toSheet, type SheetLayout, type ViewPlacement } from './views';
import type { BrepProjection } from '@barocss/cad';
import type { DrawingViews, ViewId, XY } from './types';

export const WELD_VIEWS: readonly ViewId[] = ['front', 'top', 'right'];
const OUT = 7, KNEE_GAP = 7, LINE = 16, ARROW = 2.5, ARROW_HALF = 0.6, MARK = 2.4, RING = 1.1, TEXT = 2.5;
type Side = 'left' | 'right' | 'top' | 'bottom';

export interface WeldPlaced { readonly label: string; readonly joint: string; readonly view: ViewId; readonly tip: XY; readonly edge: string }
export interface WeldSymbols { readonly groups: MarkGroup[]; readonly placed: readonly WeldPlaced[]; readonly unshown: readonly string[] }

/** A joint's seam edge in a view: a visible straight edge of its end face (its name holds the face's), its midpoint in view coordinates. */
export function seamEdge(pr: BrepProjection, face: string): { name: string; mid: XY } | null {
  let best: { name: string; mid: XY; len: number } | null = null;
  for (const e of pr.edges) {
    if (!e.ends || !e.name.split('|').includes(face) || !e.pieces.some(p => p.visible)) continue;
    const a = inView(pr, e.ends[0]), b = inView(pr, e.ends[1]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 1e-6 && (!best || len > best.len)) best = { name: e.name, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], len };
  }
  return best && { name: best.name, mid: best.mid };
}

/** The symbols of the joints (labelled W1… in their order) in the shown views. */
export function weldSymbols(layout: SheetLayout, views: DrawingViews, joints: readonly WeldJoint[]): WeldSymbols {
  const found: { j: WeldJoint; label: string; view: ViewId; tip: XY; edge: string; side: Side }[] = [], unshown: string[] = [];
  joints.forEach((j, k) => {
    const label = `W${k + 1}`;
    for (const id of WELD_VIEWS) {
      const v = layout.views[id]; if (v.hidden) continue;
      const s = seamEdge(views[id], j.face); if (!s) continue;
      const tip = toSheet(v, s.mid);
      found.push({ j, label, view: id, tip, edge: s.name, side: sideOf(v, tip) });
      return;
    }
    unshown.push(label);
  });
  const groups: MarkGroup[] = [], placed: WeldPlaced[] = [];
  for (const id of WELD_VIEWS) for (const side of ['left', 'right', 'top', 'bottom'] as Side[]) {
    const here = found.filter(f => f.view === id && f.side === side), v = layout.views[id];
    // (Along the side in order of the tips, each knee at least KNEE_GAP past the one before.)
    const along = side === 'left' || side === 'right' ? 1 : 0;
    here.sort((a, b) => a.tip[along] - b.tip[along]);
    let last = -Infinity;
    for (const f of here) {
      const t = Math.max(f.tip[along], last + KNEE_GAP); last = t;
      const knee = kneeOf(v, side, t);
      groups.push({ role: 'weld', id: f.label, view: id, marks: symbolMarks(f.tip, knee, side, f.j, f.label) });
      placed.push({ label: f.label, joint: f.j.id, view: id, tip: f.tip, edge: f.edge });
    }
  }
  return { groups, placed, unshown };
}

/** The side of the view box nearest a point on it. */
function sideOf(v: ViewPlacement, p: XY): Side {
  const [x0, y0, x1, y1] = v.box, d: [Side, number][] = [['left', p[0] - x0], ['right', x1 - p[0]], ['top', p[1] - y0], ['bottom', y1 - p[1]]];
  let best = d[0]; for (const e of d) if (e[1] < best[1]) best = e;
  return best[0];
}
/** The knee: OUT past the side, at `t` along it (sheet y grows down the paper: a box's y0 is its top). */
function kneeOf(v: ViewPlacement, side: Side, t: number): XY {
  const [x0, y0, x1, y1] = v.box;
  return side === 'left' ? [x0 - OUT, t] : side === 'right' ? [x1 + OUT, t] : side === 'top' ? [t, y0 - OUT] : [t, y1 + OUT];
}

function symbolMarks(tip: XY, knee: XY, side: Side, j: WeldJoint, label: string): Mark[] {
  const dir = side === 'left' ? -1 : 1, end: XY = [knee[0] + dir * LINE, knee[1]], d = [tip[0] - knee[0], tip[1] - knee[1]], l = Math.hypot(d[0], d[1]) || 1, u: XY = [d[0] / l, d[1] / l];
  const back: XY = [tip[0] - u[0] * ARROW, tip[1] - u[1] * ARROW], n: XY = [-u[1] * ARROW_HALF, u[0] * ARROW_HALF];
  const marks: Mark[] = [
    { kind: 'line', a: knee, b: back, pen: 'thin' },
    { kind: 'fill', points: [tip, [back[0] + n[0], back[1] + n[1]], [back[0] - n[0], back[1] - n[1]]] },
    { kind: 'line', a: knee, b: end, pen: 'thin' },
  ];
  // (The weld's mark on the reference line, a third along it; the size just before it.)
  const mx = knee[0] + dir * LINE / 3, my = knee[1];
  if (j.weld.kind === 'fillet') marks.push({ kind: 'polyline', points: [[mx, my], [mx, my - MARK], [mx + dir * MARK, my], [mx, my]], pen: 'thin' });
  else marks.push({ kind: 'line', a: [mx, my], b: [mx, my - MARK], pen: 'thin' }, { kind: 'line', a: [mx + dir * MARK * 0.6, my], b: [mx + dir * MARK * 0.6, my - MARK], pen: 'thin' });
  if (j.weld.sizeMM !== null) marks.push({ kind: 'text', at: [mx - dir * 1, my - 0.6], text: `${+j.weld.sizeMM.toFixed(2)}${j.weld.sizeBasis === 'estimate' ? '*' : ''}`, size: TEXT, anchor: dir > 0 ? 'end' : 'start' });
  if (j.weld.allRound) marks.push(ring(knee, RING));
  if (j.innerLoop?.welded) marks.push(ring(knee, RING * 1.8));
  marks.push({ kind: 'text', at: [end[0] + dir * 1, end[1] + 0.9], text: label, size: TEXT, anchor: dir > 0 ? 'start' : 'end' });
  return marks;
}
const ring = (c: XY, r: number): Mark => ({ kind: 'arc', center: c, u: [r, 0], v: [0, r], t0: 0, t1: 2 * Math.PI, pen: 'thin' });
