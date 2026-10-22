// O147 B2: item balloons — one a BOM line, on the assembly's iso view (the front view when the iso is not shown), its
// number the line's in the BOM table (the panel's and the purchase list's). Each leads to a visible edge of an instance
// of its item, found by persistent name, so it follows the model as it changes: a placed part's edges are `<inst>/…`, an
// element's are its node's faces (`<node>.…`, in a placed part `<inst>/<node>.…`), and a part's balloon points at an edge
// of its own made shape, not at one of its bought elements. The tip is the middle of the longest visible piece of the
// edge. Each is placed, as the weld symbols are (O119), along the view's side nearest its tip in GAP steps, then the
// other sides, where its circle is clear of the views, the title block, the texts so far and the balloons before it;
// none clear, at its nearest place, and the issue list says so. A line none of whose items shows an edge in the view
// has no balloon, and is said.
import type { BrepProjection, ProjectedCurve } from '@barocss/cad';
import type { Bom } from '../team/bomCore';
import type { Mark, MarkGroup } from './sheet';
import { toSheet, type SheetLayout, type ViewPlacement } from './views';
import type { DrawingViews, ViewId, XY } from './types';

const R = 3.5, OUT = 6, GAP = 2 * R + 2, TRIES = 16, CLEAR = 1, TEXT = 3, ARROW = 2.2, ARROW_HALF = 0.55;
type Side = 'left' | 'right' | 'top' | 'bottom';
type Rect = [number, number, number, number];
const SIDES: readonly Side[] = ['left', 'right', 'top', 'bottom'];
const alongOf = (side: Side) => side === 'left' || side === 'right' ? 1 : 0;

export interface BalloonPlaced { readonly no: number; readonly item: string; readonly view: ViewId; readonly tip: XY; readonly edge: string; readonly at: XY }
export interface Balloons { readonly groups: MarkGroup[]; readonly placed: readonly BalloonPlaced[]; /** Item numbers placed with no clear room. */ readonly unclear: readonly number[]; /** Item numbers with no visible edge in the view. */ readonly noEdge: readonly number[] }

/** What a line's balloon may point at: an instance (`<inst>/`, `base` the part itself) or an element (`<inst>/<node>.`). */
interface Target { inst: string; node: string | null }
const targetOf = (line: Bom['lines'][number], id: string): Target => {
  if (line.kind === undefined) return { inst: id, node: null };
  const k = id.indexOf(':');
  return { inst: id.slice(0, k), node: id.slice(k + 1) };
};
/** An edge's instance (`base`: the part's own) and its faces' names without the prefix. */
function edgeOf(name: string): { inst: string; faces: string[] } {
  const slash = name.indexOf('/'), dot = name.indexOf('.');
  const inst = slash >= 0 && (dot < 0 || slash < dot) ? name.slice(0, slash) : 'base';
  return { inst, faces: (inst === 'base' ? name : name.slice(slash + 1)).split('|') };
}
const ofNode = (faces: readonly string[], node: string) => faces.some(f => f.startsWith(`${node}.`));

/** A piece's length and middle (view coordinates). */
function middleOf(c: ProjectedCurve): { len: number; mid: XY } {
  if (c.kind === 'line') return { len: Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]), mid: [(c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2] };
  if (c.kind === 'arc') {
    const t = (c.t0 + c.t1) / 2, r = (Math.hypot(c.u[0], c.u[1]) + Math.hypot(c.v[0], c.v[1])) / 2;
    return { len: r * Math.abs(c.t1 - c.t0), mid: [c.center[0] + c.u[0] * Math.cos(t) + c.v[0] * Math.sin(t), c.center[1] + c.u[1] * Math.cos(t) + c.v[1] * Math.sin(t)] };
  }
  const p = c.points, seg: number[] = [];
  let len = 0;
  for (let k = 1; k < p.length; k++) { const l = Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); seg.push(l); len += l; }
  let walked = 0;
  for (let k = 1; k < p.length; k++) {
    if (walked + seg[k - 1] >= len / 2 && seg[k - 1] > 0) { const s = (len / 2 - walked) / seg[k - 1]; return { len, mid: [p[k - 1][0] + s * (p[k][0] - p[k - 1][0]), p[k - 1][1] + s * (p[k][1] - p[k - 1][1])] }; }
    walked += seg[k - 1];
  }
  return { len, mid: [p[0][0], p[0][1]] };
}

/**
 * The longest visible piece of an edge of `t` in the view (its edge's name and middle), or null. A part's own edges
 * leave out its elements' (`elements`: the nodes, by instance, of the BOM's element lines).
 */
export function targetEdge(pr: BrepProjection, t: Target, elements: ReadonlyMap<string, ReadonlySet<string>>): { name: string; mid: XY } | null {
  let best: { name: string; mid: XY; len: number } | null = null;
  for (const e of pr.edges) {
    const { inst, faces } = edgeOf(e.name);
    if (inst !== t.inst) continue;
    if (t.node !== null ? !ofNode(faces, t.node) : [...(elements.get(inst) ?? [])].some(n => ofNode(faces, n))) continue;
    for (const p of e.pieces) {
      if (!p.visible) continue;
      const m = middleOf(p.curve);
      if (m.len > 1e-6 && (!best || m.len > best.len)) best = { name: e.name, mid: m.mid, len: m.len };
    }
  }
  return best && { name: best.name, mid: best.mid };
}

/** The balloons of the BOM's lines (numbered as the table is: 1… in its order) on the iso view, or the front view. */
export function balloonMarks(layout: SheetLayout, views: DrawingViews, bom: Bom, taken: readonly Rect[]): Balloons {
  const view: ViewId = layout.views.iso.hidden ? 'front' : 'iso', v = layout.views[view], pr = views[view];
  const elements = new Map<string, Set<string>>();
  for (const l of bom.lines) if (l.kind !== undefined) for (const id of l.parts) { const t = targetOf(l, id); (elements.get(t.inst) ?? elements.set(t.inst, new Set()).get(t.inst)!).add(t.node!); }
  const found: { no: number; item: string; tip: XY; edge: string; side: Side }[] = [], noEdge: number[] = [];
  bom.lines.forEach((l, k) => {
    for (const id of l.parts) {
      const e = targetEdge(pr, targetOf(l, id), elements); if (!e) continue;
      const tip = toSheet(v, e.mid);
      found.push({ no: k + 1, item: l.item, tip, edge: e.name, side: sideOf(v, tip) });
      return;
    }
    noEdge.push(k + 1);
  });
  // (By side and along it, so neighbouring balloons' leaders do not cross; each the first clear place from its tip.)
  found.sort((a, b) => SIDES.indexOf(a.side) - SIDES.indexOf(b.side) || a.tip[alongOf(a.side)] - b.tip[alongOf(b.side)]);
  const groups: MarkGroup[] = [], placed: BalloonPlaced[] = [], unclear: number[] = [], mine: Rect[] = [];
  for (const f of found) {
    let at: XY | null = null;
    for (const side of [f.side, ...SIDES.filter(x => x !== f.side)]) {
      for (let k = 0; k <= 2 * TRIES && !at; k++) {
        const step = k % 2 ? (k + 1) / 2 : -k / 2, c = centreOf(v, side, f.tip[alongOf(side)] + step * GAP);
        if (clear(boxAt(c), layout, taken, mine)) at = c;
      }
      if (at) break;
    }
    if (!at) { at = centreOf(v, f.side, f.tip[alongOf(f.side)]); unclear.push(f.no); }
    mine.push(boxAt(at));
    groups.push({ role: 'balloon', id: String(f.no), view, marks: balloon(at, f.tip, f.no) });
    placed.push({ no: f.no, item: f.item, view, tip: f.tip, edge: f.edge, at });
  }
  placed.sort((a, b) => a.no - b.no);
  return { groups, placed, unclear: unclear.sort((a, b) => a - b), noEdge };
}

function sideOf(v: ViewPlacement, p: XY): Side {
  const [x0, y0, x1, y1] = v.box, d: [Side, number][] = [['left', p[0] - x0], ['right', x1 - p[0]], ['top', p[1] - y0], ['bottom', y1 - p[1]]];
  let best = d[0]; for (const e of d) if (e[1] < best[1]) best = e;
  return best[0];
}
/** A balloon's centre OUT past the side (its circle just outside), at `t` along it (sheet y grows down the paper). */
function centreOf(v: ViewPlacement, side: Side, t: number): XY {
  const [x0, y0, x1, y1] = v.box, d = OUT + R;
  return side === 'left' ? [x0 - d, t] : side === 'right' ? [x1 + d, t] : side === 'top' ? [t, y0 - d] : [t, y1 + d];
}
const boxAt = (c: XY): Rect => [c[0] - R, c[1] - R, c[0] + R, c[1] + R];

/** The circle, its number in it, and the leader from the circle to an arrow on the edge. */
function balloon(c: XY, tip: XY, no: number): Mark[] {
  const d = [tip[0] - c[0], tip[1] - c[1]], l = Math.hypot(d[0], d[1]) || 1, u: XY = [d[0] / l, d[1] / l];
  const from: XY = [c[0] + u[0] * R, c[1] + u[1] * R], back: XY = [tip[0] - u[0] * ARROW, tip[1] - u[1] * ARROW], n: XY = [-u[1] * ARROW_HALF, u[0] * ARROW_HALF];
  return [
    { kind: 'arc', center: c, u: [R, 0], v: [0, R], t0: 0, t1: 2 * Math.PI, pen: 'thin' },
    { kind: 'text', at: [c[0], c[1] + TEXT * 0.35], text: String(no), size: TEXT, anchor: 'middle' },
    ...(l > R + ARROW ? [{ kind: 'line', a: from, b: back, pen: 'thin' } as Mark, { kind: 'fill', points: [tip, [back[0] + n[0], back[1] + n[1]], [back[0] - n[0], back[1] - n[1]]] } as Mark] : []),
  ];
}

const meets = (a: Rect, b: Rect, gap: number) => a[0] < b[2] + gap && b[0] < a[2] + gap && a[1] < b[3] + gap && b[1] < a[3] + gap;
/** Inside the frame and clear of what was taken (the views, the title block, the texts so far) and the balloons placed. */
function clear(box: Rect, layout: SheetLayout, taken: readonly Rect[], mine: readonly Rect[]): boolean {
  const f = layout.frame;
  if (box[0] < f[0] + CLEAR || box[1] < f[1] + CLEAR || box[2] > f[2] - CLEAR || box[3] > f[3] - CLEAR) return false;
  for (const t of taken) if (meets(box, t, CLEAR)) return false;
  for (const t of mine) if (meets(box, t, CLEAR)) return false;
  return true;
}
