// FRd2 (O119): weld symbols in the drawing's views — our own glyphs built from each joint's geometry, no standard's text:
// an arrow on a seam edge (an edge of the joint's end face, found by its persistent name in the view, so it follows the
// part as it changes), a leader to a knee just outside the view, a reference line with the weld's mark on it (a fillet a
// small right triangle, a butt weld two short bars), the size before the mark, a ring at the knee where it goes all
// round, a second ring where the bore is welded too, and the joint's W-number at the line's end (the weld list's).
// Each joint is shown once, in the first view (front, top, right) where an edge of its end face is visible; a joint seen
// in none is said (`unshown`). Each is placed where its symbol (but its leader) is clear of the views, the title block and
// the symbols before it: along its nearest side in KNEE_GAP steps from its tip, then the other sides.
import type { WeldJoint } from '../frames/welds';
import { inView } from './dimensions';
import { textCorners } from './text';
import type { Mark, MarkGroup } from './sheet';
import { toSheet, type SheetLayout, type ViewPlacement } from './views';
import type { BrepProjection } from '@barocss/cad';
import type { DrawingViews, ViewId, XY } from './types';

export const WELD_VIEWS: readonly ViewId[] = ['front', 'top', 'right'];
const OUT = 7, KNEE_GAP = 7, TRIES = 12, CLEAR = 1, LINE = 16, ARROW = 2.5, ARROW_HALF = 0.6, MARK = 2.4, RING = 1.1, TEXT = 2.5;
export type Side = 'left' | 'right' | 'top' | 'bottom';
type Rect = [number, number, number, number];
const SIDES: readonly Side[] = ['left', 'right', 'top', 'bottom'];
const alongOf = (side: Side) => side === 'left' || side === 'right' ? 1 : 0;
/** The nearest side first, then the rest. */
const sidesFrom = (first: Side): Side[] => [first, ...SIDES.filter(x => x !== first)];

export interface WeldPlaced { readonly label: string; readonly joint: string; readonly view: ViewId; readonly tip: XY; readonly edge: string }
export interface WeldSymbols { readonly groups: MarkGroup[]; readonly placed: readonly WeldPlaced[]; readonly unshown: readonly string[] }

/** Whether an edge bounds a face, its pieces counted as the face (`n0_env1#2` is `n0_env1`'s, O173). */
const PIECE = /#\d+$/;
function onFace(edge: string, face: string): boolean {
  for (const f of edge.split('|')) if (f === face || f.replace(PIECE, '') === face) return true;
  return false;
}
/**
 * A joint's seam edge in a view: a visible straight edge of its end face (its name holds the face's), its midpoint in view
 * coordinates. A trimmed end face comes in pieces (`#1`, `#2`), each the face's; and an edge with no pieces lies wholly on
 * visible ink (BrepProjection) — a seam on its member's outline, visible though another edge draws it (O173, F8: both read
 * as unseen, 12 of A9's frame's welds had no symbol).
 */
export function seamEdge(pr: BrepProjection, face: string): { name: string; mid: XY } | null {
  // (An edge drawn in its own pieces before one only on another's ink, then the longer, then by name: the same edge
  // whatever order the view lists them in, so an arrow follows its seam through an edit.)
  let best: { name: string; mid: XY; len: number; own: boolean } | null = null;
  for (const e of pr.edges) {
    if (!e.ends || !onFace(e.name, face) || (e.pieces.length > 0 && !e.pieces.some(p => p.visible))) continue;
    const a = inView(pr, e.ends[0]), b = inView(pr, e.ends[1]), len = Math.hypot(b[0] - a[0], b[1] - a[1]), own = e.pieces.length > 0;
    if (len <= 1e-6) continue;
    const better = !best || (own !== best.own ? own : Math.abs(len - best.len) > 1e-6 ? len > best.len : e.name < best.name);
    if (better) best = { name: e.name, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], len, own };
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
  const groups: MarkGroup[] = [], placed: WeldPlaced[] = [], taken: Rect[] = [];
  // (Each in turn, by view and along its side: the first knee whose symbol — but its leader — is clear of every view, the
  // title block, the frame's edge and the symbols placed; none clear, its nearest knee, and the issue list says so.)
  found.sort((a, b) => WELD_VIEWS.indexOf(a.view) - WELD_VIEWS.indexOf(b.view) || a.side.localeCompare(b.side) || a.tip[alongOf(a.side)] - b.tip[alongOf(b.side)]);
  for (const f of found) {
    const v = layout.views[f.view];
    let best: { marks: Mark[]; box: Rect } | null = null;
    for (const side of sidesFrom(f.side)) {
      for (let k = 0; k <= 2 * TRIES && !best; k++) {
        const step = k % 2 ? (k + 1) / 2 : -k / 2, t = f.tip[alongOf(side)] + step * KNEE_GAP;
        const marks = symbolMarks(f.tip, kneeOf(v, side, t), side, f.j, f.label), box = boxOf(marks);
        if (clear(box, layout, taken)) best = { marks, box };
      }
      if (best) break;
    }
    if (!best) { const marks = symbolMarks(f.tip, kneeOf(v, f.side, f.tip[alongOf(f.side)]), f.side, f.j, f.label); best = { marks, box: boxOf(marks) }; }
    taken.push(best.box);
    groups.push({ role: 'weld', id: f.label, view: f.view, marks: best.marks });
    placed.push({ label: f.label, joint: f.j.id, view: f.view, tip: f.tip, edge: f.edge });
  }
  placed.sort((a, b) => Number(a.label.slice(1)) - Number(b.label.slice(1)));
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

export function symbolMarks(tip: XY, knee: XY, side: Side, j: WeldJoint, label: string): Mark[] {
  const dir = side === 'left' ? -1 : 1, end: XY = [knee[0] + dir * LINE, knee[1]], d = [tip[0] - knee[0], tip[1] - knee[1]], l = Math.hypot(d[0], d[1]) || 1, u: XY = [d[0] / l, d[1] / l];
  const back: XY = [tip[0] - u[0] * ARROW, tip[1] - u[1] * ARROW], n: XY = [-u[1] * ARROW_HALF, u[0] * ARROW_HALF];
  const marks: Mark[] = [
    { kind: 'line', a: knee, b: back, pen: 'thin', role: 'leader' },
    { kind: 'fill', points: [tip, [back[0] + n[0], back[1] + n[1]], [back[0] - n[0], back[1] - n[1]]], head: { style: 'filled', tip, dir: u, length: ARROW, width: 2 * ARROW_HALF } },
    { kind: 'line', a: knee, b: end, pen: 'thin', role: 'weld' },
  ];
  // (The weld's mark on the reference line, a third along it; the size just before it.)
  const mx = knee[0] + dir * LINE / 3, my = knee[1];
  if (j.weld.kind === 'fillet') marks.push({ kind: 'polyline', points: [[mx, my], [mx, my - MARK], [mx + dir * MARK, my], [mx, my]], pen: 'thin', role: 'weld' });
  else marks.push({ kind: 'line', a: [mx, my], b: [mx, my - MARK], pen: 'thin', role: 'weld' }, { kind: 'line', a: [mx + dir * MARK * 0.6, my], b: [mx + dir * MARK * 0.6, my - MARK], pen: 'thin', role: 'weld' });
  if (j.weld.size !== null) marks.push({ kind: 'text', at: [mx - dir * 1, my - 0.6], text: `${+j.weld.size.toFixed(2)}${j.weld.sizeBasis === 'estimate' ? '*' : ''}`, size: TEXT, anchor: dir > 0 ? 'end' : 'start' });
  if (j.weld.allRound) marks.push(ring(knee, RING));
  if (j.innerLoop?.welded) marks.push(ring(knee, RING * 1.8));
  marks.push({ kind: 'text', at: [end[0] + dir * 1, end[1] + 0.9], text: label, size: TEXT, anchor: dir > 0 ? 'start' : 'end' });
  return marks;
}
const ring = (c: XY, r: number): Mark => ({ kind: 'arc', center: c, u: [r, 0], v: [0, r], t0: 0, t1: 2 * Math.PI, pen: 'thin', role: 'weld' });

/** A symbol's box but its leader and arrow (they run into the view by design): its knee, reference line, mark, rings and texts. */
function boxOf(marks: readonly Mark[]): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (x: number, y: number) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
  marks.forEach((m, k) => {
    if (k < 2) return;
    if (m.kind === 'line') { take(m.a[0], m.a[1]); take(m.b[0], m.b[1]); }
    else if (m.kind === 'polyline') for (const p of m.points) take(p[0], p[1]);
    else if (m.kind === 'arc') { take(m.center[0] - m.u[0], m.center[1] - m.v[1]); take(m.center[0] + m.u[0], m.center[1] + m.v[1]); }
    else if (m.kind === 'text') for (const p of textCorners(m.at, m.text, m.size, m.anchor, m.angle ?? 0, !!m.bold)) take(p[0], p[1]);
  });
  return [x0, y0, x1, y1];
}
const meets = (a: Rect, b: Rect, gap: number) => a[0] < b[2] + gap && b[0] < a[2] + gap && a[1] < b[3] + gap && b[1] < a[3] + gap;
/** Clear of every shown view's box, the title block, the symbols placed, and inside the frame. */
function clear(box: Rect, layout: SheetLayout, taken: readonly Rect[]): boolean {
  const f = layout.frame;
  if (box[0] < f[0] + CLEAR || box[1] < f[1] + CLEAR || box[2] > f[2] - CLEAR || box[3] > f[3] - CLEAR) return false;
  if (meets(box, layout.title, CLEAR)) return false;
  for (const id of ['front', 'top', 'right', 'iso'] as const) { const v = layout.views[id]; if (!v.hidden && meets(box, v.box, CLEAR)) return false; }
  for (const x of layout.sections ?? []) if (meets(box, x.box, CLEAR)) return false;
  for (const t of taken) if (meets(box, t, CLEAR)) return false;
  return true;
}
