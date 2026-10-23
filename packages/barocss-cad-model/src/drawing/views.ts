// The standard views and their arrangement on a sheet. The part's Z is up; the front view looks
// along +Y (from -Y), the top view down -Z, the right view along -X, the isometric from the
// front-right-top corner. Third angle puts the top view above the front view and the right view to its
// right; first angle puts the top view below it and the right view to its left. The views in one
// column share their horizontal (model X) mapping, the views in one row their vertical (model Z), so
// they stay in projection with each other.
import type { HiddenLineView } from '@barocss/cad';
import type { DrawingSection, DrawingSettings, DrawingViews, SectionViewId, ViewId, XY } from './types';

/**
 * Which side of the part the front view looks from (R14.3b, O7): `y-` (from −Y, the default and every drawing saved
 * before), `x+`, `y+` or `x-`. The top view always looks down Z with the front's horizontal axis kept; the right view
 * is the front turned a quarter to its right; the isometric from the front-right-top corner.
 */
export type Orientation = 'y-' | 'x+' | 'y+' | 'x-';
export const ORIENTATIONS: readonly Orientation[] = ['y-', 'x+', 'y+', 'x-'];
const TOWARD: Record<Orientation, [number, number, number]> = { 'y-': [0, -1, 0], 'x+': [1, 0, 0], 'y+': [0, 1, 0], 'x-': [-1, 0, 0] };
/** The views for an orientation (the default's are exactly the views drawings have always had). */
export function viewsFor(o: Orientation = 'y-'): Record<ViewId, HiddenLineView & { label: string }> {
  const t = TOWARD[o], r: [number, number, number] = [-t[1] || 0, t[0] || 0, 0], d: [number, number, number] = [-t[0] || 0, -t[1] || 0, 0];
  return {
    front: { toward: t, up: [0, 0, 1], label: 'FRONT' },
    top: { toward: [0, 0, 1], up: d, label: 'TOP' },
    right: { toward: r, up: [0, 0, 1], label: 'RIGHT' },
    iso: { toward: [t[0] + r[0], t[1] + r[1], 1], up: [0, 0, 1], label: 'ISOMETRIC' },
  };
}
export const VIEWS: Record<ViewId, HiddenLineView & { label: string }> = viewsFor('y-');
/** The front view's depth (away from the viewer): section A–A's plane is square to it (`section.y` along it). */
export const depthOf = (o: Orientation = 'y-'): [number, number, number] => { const t = TOWARD[o]; return [-t[0] || 0, -t[1] || 0, 0]; };

/** A view's depth (away from its viewer): a principal axis, as its index and sign. */
export function sectionDepth(view: SectionViewId, orientation: Orientation = 'y-'): { k: 0 | 1 | 2; sign: 1 | -1; d: [number, number, number] } {
  const t = viewsFor(orientation)[view].toward, d: [number, number, number] = [-t[0] || 0, -t[1] || 0, -t[2] || 0];
  const k = (d[0] ? 0 : d[1] ? 1 : 2) as 0 | 1 | 2;
  return { k, sign: d[k] > 0 ? 1 : -1, d };
}

/**
 * A section's frame: its depth `d` (a unit vector away from its viewer), the principal axis it is square to (null for
 * an aligned one, O178), and the view it is seen in. A principal section is seen as its view is; an aligned one looks
 * along its own `dir`, with its view's up made square to it (or, that up along `dir`, the view's depth).
 */
export function sectionFrame(s: Pick<DrawingSection, 'view' | 'dir'>, o: Orientation = 'y-'): { d: [number, number, number]; principal: { k: 0 | 1 | 2; sign: 1 | -1 } | null; view: HiddenLineView } {
  const base = viewsFor(o)[s.view];
  if (!s.dir) { const { k, sign, d } = sectionDepth(s.view, o); return { d, principal: { k, sign }, view: base }; }
  const n = Math.hypot(s.dir[0], s.dir[1], s.dir[2]), d: [number, number, number] = [s.dir[0] / n, s.dir[1] / n, s.dir[2] / n];
  const square = (v: readonly number[]): [number, number, number] | null => {
    const t = v[0] * d[0] + v[1] * d[1] + v[2] * d[2], w = [v[0] - t * d[0], v[1] - t * d[1], v[2] - t * d[2]], l = Math.hypot(w[0], w[1], w[2]);
    return l > 1e-6 ? [w[0] / l, w[1] / l, w[2] / l] : null;
  };
  const back = base.toward, up = square(base.up) ?? square([-back[0], -back[1], -back[2]])!;
  return { d, principal: null, view: { toward: [-d[0] || 0, -d[1] || 0, -d[2] || 0], up } };
}

/** Sheet sizes (landscape, mm). */
export const SHEETS = { A4: [297, 210], A3: [420, 297] } as const;
/** Standard scales, largest first (2 = 2:1, 0.5 = 1:2). */
export const SCALES = [10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
export const scaleLabel = (s: number) => s >= 1 ? `${round(s)}:1` : `1:${round(1 / s)}`;
const round = (v: number) => Math.round(v * 1000) / 1000;

export const MARGIN = 10;
/** The title block, at the frame's lower right. */
export const TITLE_BLOCK = { width: 120, height: 32 };
/** Space between views, and around them inside the drawing area (room for dimensions). */
const GAP = 22, PAD = 14;

/** `hidden`: a view the settings do not show (R14.3, O4): placed nowhere (an empty box at its cell), drawn nowhere. */
export interface ViewPlacement { id: ViewId | 'section'; scale: number; origin: XY; box: [number, number, number, number]; hidden?: true }
export interface SheetLayout {
  size: [number, number]; scale: number; fits: boolean;
  frame: [number, number, number, number];
  title: [number, number, number, number];
  views: Record<ViewId, ViewPlacement>;
  /**
   * O148 X1: the sections, each placed in projection with its view: a front's or a right's in a row under the views, in
   * its view's column (one after another along the row where they would meet); a top's beside the top view, on the side
   * away from its neighbour (third angle: left; first angle: right), in its row.
   */
  sections?: SectionPlacement[];
}
export interface SectionPlacement extends ViewPlacement { section: string; of: SectionViewId }
/** A section's extent (view coordinates), for the layout. */
export interface SectionExtent { id: string; view: SectionViewId; min: readonly number[]; max: readonly number[] }

/** A view point (model mm in the view's frame) on the sheet (mm, y down). */
export const toSheet = (v: ViewPlacement, p: readonly number[]): XY => [v.origin[0] + v.scale * p[0], v.origin[1] - v.scale * p[1]];
export const fromSheet = (v: ViewPlacement, q: readonly number[]): XY => [(q[0] - v.origin[0]) / v.scale, (v.origin[1] - q[1]) / v.scale];

/** Cells [column, row] of each view. */
const CELLS: Record<DrawingSettings['projection'], Record<ViewId, [number, number]>> = {
  third: { top: [0, 0], iso: [1, 0], front: [0, 1], right: [1, 1] },
  first: { right: [0, 0], front: [1, 0], iso: [0, 1], top: [1, 1] },
};
/** The orthographic views that share a column's horizontal or a row's vertical mapping. */
const SHARED_U: ViewId[] = ['front', 'top'], SHARED_V: ViewId[] = ['front', 'right'];

/** Sheet mm left between a view's dimensions and the next view's (R14.3). */
const ROOM_CLEAR = 3;
/** Sheet mm a view's name takes under it (and its dimensions). */
const LABEL_ROOM = 7;

/**
 * `sections`: the extents of the sections (view coordinates; a single extent is section A–A on the front, as older
 * callers give it). Views the settings do not show take
 * no room; `settings.room` (sheet mm beside each view's sides, for its dimensions, R14.3) widens the gaps between the
 * views and the margins round them where it is more than they give already. Without either, the layout is as before.
 */
export function layoutSheet(views: DrawingViews, settings: DrawingSettings, sectionsIn?: readonly SectionExtent[] | { min: readonly number[]; max: readonly number[] }): SheetLayout {
  const sections: readonly SectionExtent[] = !sectionsIn ? [] : 'min' in sectionsIn ? [{ id: 'A', view: 'front', min: sectionsIn.min, max: sectionsIn.max }] : sectionsIn;
  const [W, H] = SHEETS[settings.sheet];
  const frame: SheetLayout['frame'] = [MARGIN, MARGIN, W - MARGIN, H - MARGIN];
  const title: SheetLayout['title'] = [frame[2] - TITLE_BLOCK.width, frame[3] - TITLE_BLOCK.height, frame[2], frame[3]];
  // The drawing area: the frame above the title block's band.
  const area = [frame[0] + PAD, frame[1] + PAD, frame[2] - PAD, title[1] - PAD];
  const cells = CELLS[settings.projection], shown = (id: ViewId) => !settings.views || settings.views.includes(id) || id === 'front' || id === 'top';
  const ids = (Object.keys(cells) as ViewId[]).filter(shown);
  const ext = (id: ViewId) => ({ u: [views[id].min[0], views[id].max[0]], v: [views[id].min[1], views[id].max[1]] });
  // Column widths and row heights in model mm: a shared mapping spans the union of its views.
  const colU: [number, number][] = [[Infinity, -Infinity], [Infinity, -Infinity]], colW = [0, 0];
  const rowV: [number, number][] = [[Infinity, -Infinity], [Infinity, -Infinity]], rowH = [0, 0];
  const shared = (id: ViewId, list: ViewId[], col: boolean) => list.includes(id) && list.some(o => o !== id && shown(o) && cells[o][col ? 0 : 1] === cells[id][col ? 0 : 1]);
  for (const id of ids) {
    const [c, r] = cells[id], e = ext(id);
    if (shared(id, SHARED_U, true)) { colU[c] = [Math.min(colU[c][0], e.u[0]), Math.max(colU[c][1], e.u[1])]; }
    colW[c] = Math.max(colW[c], e.u[1] - e.u[0]);
    if (shared(id, SHARED_V, false)) { rowV[r] = [Math.min(rowV[r][0], e.v[0]), Math.max(rowV[r][1], e.v[1])]; }
    rowH[r] = Math.max(rowH[r], e.v[1] - e.v[0]);
  }
  for (const k of [0, 1]) { if (colU[k][0] < colU[k][1]) colW[k] = Math.max(colW[k], colU[k][1] - colU[k][0]); if (rowV[k][0] < rowV[k][1]) rowH[k] = Math.max(rowH[k], rowV[k][1] - rowV[k][0]); }
  // Room for dimensions: what the views of a column or row need beside them, against what the gap and margins give.
  const need = (id: ViewId, side: 'above' | 'below' | 'left' | 'right') => settings.room?.[id]?.[side] ?? 0;
  const most = (pick: (id: ViewId) => boolean, side: 'above' | 'below' | 'left' | 'right') => Math.max(0, ...ids.filter(pick).map(id => need(id, side) + (side === 'below' ? LABEL_ROOM : 0)));
  const inCol = (c: number) => (id: ViewId) => cells[id][0] === c, inRow = (r: number) => (id: ViewId) => cells[id][1] === r;
  const room = !!settings.room;
  const colGap = room ? Math.max(GAP, most(inCol(0), 'right') + most(inCol(1), 'left') + ROOM_CLEAR) : GAP;
  const rowGap = room ? Math.max(GAP, most(inRow(0), 'below') + most(inRow(1), 'above') + ROOM_CLEAR) : GAP;
  const outer = { left: room ? Math.max(0, most(inCol(0), 'left') - PAD + ROOM_CLEAR) : 0, right: room ? Math.max(0, most(inCol(1), 'right') - PAD + ROOM_CLEAR) : 0,
    top: room ? Math.max(0, most(inRow(0), 'above') - PAD + ROOM_CLEAR) : 0, bottom: room ? Math.max(0, most(inRow(1), 'below') - PAD + ROOM_CLEAR) : 0 };
  // The front's and the right's sections take a third row under the views (past the front view's dimensions); the
  // top's a column beside the top view, on the side away from its neighbour.
  const below = sections.filter(x => x.view !== 'top'), beside = sections.filter(x => x.view === 'top'), side = cells.top[0] === 0 ? 'left' : 'right';
  const widthOf = (x: SectionExtent) => x.max[0] - x.min[0];
  const secGap = room ? Math.max(GAP, need('front', 'below') + LABEL_ROOM + ROOM_CLEAR) : GAP;
  const secH = Math.max(0, ...below.map(x => x.max[1] - x.min[1])), extraH = (s: number) => below.length ? s * secH + secGap : 0;
  const sideW = (s: number) => beside.reduce((w, x) => w + s * widthOf(x) + GAP, 0);
  // (Two or more in the row: their widths count, one after another; one alone keeps to its view's column.)
  const rowW = (s: number) => below.length > 1 ? below.reduce((w, x) => w + s * widthOf(x), 0) + GAP * (below.length - 1) : 0;
  const viewsW = (s: number) => Math.max(s * (colW[0] + colW[1]) + colGap, rowW(s));
  const fitsAt = (s: number) => viewsW(s) + sideW(s) + outer.left + outer.right <= area[2] - area[0] && s * (rowH[0] + rowH[1]) + rowGap + outer.top + outer.bottom + extraH(s) <= area[3] - area[1];
  const scale = settings.scale ?? SCALES.find(fitsAt) ?? SCALES[SCALES.length - 1];
  const totalW = viewsW(scale) + sideW(scale) + outer.left + outer.right, totalH = scale * (rowH[0] + rowH[1]) + rowGap + outer.top + outer.bottom + extraH(scale);
  const x0 = area[0] + Math.max(0, (area[2] - area[0] - totalW) / 2) + outer.left + (side === 'left' ? sideW(scale) : 0), y0 = area[1] + Math.max(0, (area[3] - area[1] - totalH) / 2) + outer.top;
  const colX = [x0, x0 + scale * colW[0] + colGap], rowY = [y0, y0 + scale * rowH[0] + rowGap];
  const placed = {} as Record<ViewId, ViewPlacement>;
  for (const id of Object.keys(cells) as ViewId[]) {
    const [c, r] = cells[id], e = ext(id);
    if (!shown(id)) { placed[id] = { id, scale, origin: [colX[c], rowY[r]], box: [colX[c], rowY[r], colX[c], rowY[r]], hidden: true }; continue; }
    const ox = shared(id, SHARED_U, true) ? colX[c] + scale * (colW[c] - (colU[c][1] - colU[c][0])) / 2 - scale * colU[c][0]
      : colX[c] + (scale * colW[c] - scale * (e.u[1] - e.u[0])) / 2 - scale * e.u[0];
    const oy = shared(id, SHARED_V, false) ? rowY[r] + scale * (rowH[r] - (rowV[r][1] - rowV[r][0])) / 2 + scale * rowV[r][1]
      : rowY[r] + (scale * rowH[r] - scale * (e.v[1] - e.v[0])) / 2 + scale * e.v[1];
    placed[id] = { id, scale, origin: [ox, oy], box: [ox + scale * e.u[0], oy - scale * e.v[1], ox + scale * e.u[1], oy - scale * e.v[0]] };
  }
  const placedSections: SectionPlacement[] = [];
  const at = (x: SectionExtent, ox: number, oy: number): SectionPlacement => ({ id: 'section', section: x.id, of: x.view, scale, origin: [ox, oy], box: [ox + scale * x.min[0], oy - scale * x.max[1], ox + scale * x.max[0], oy - scale * x.min[1]] });
  // (Under the views: each in its view's column, moved along the row past the one before where they would meet.)
  let rowEnd = -Infinity;
  for (const x of below) {
    let ox = placed[x.view].origin[0];
    if (ox + scale * x.min[0] < rowEnd + GAP) ox = rowEnd + GAP - scale * x.min[0];
    const p = at(x, ox, rowY[1] + scale * rowH[1] + secGap + scale * x.max[1]);
    placedSections.push(p); rowEnd = p.box[2];
  }
  // (Beside the top view: outward from it, in its row.)
  let edge = side === 'left' ? placed.top.box[0] : placed.top.box[2];
  for (const x of beside) {
    const w = scale * widthOf(x), ox = side === 'left' ? edge - GAP - scale * x.max[0] : edge + GAP - scale * x.min[0];
    const p = at(x, ox, placed.top.origin[1]);
    placedSections.push(p); edge = side === 'left' ? edge - GAP - w : edge + GAP + w;
  }
  const order = new Map(sections.map((x, k) => [x.id, k]));
  placedSections.sort((a, b) => order.get(a.section)! - order.get(b.section)!);
  return { size: [W, H], scale, fits: fitsAt(scale), frame, title, views: placed, ...(placedSections.length ? { sections: placedSections } : {}) };
}
