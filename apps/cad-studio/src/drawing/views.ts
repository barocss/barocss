// The standard views and their arrangement on a sheet. The part's Z is up; the front view looks
// along +Y (from -Y), the top view down -Z, the right view along -X, the isometric from the
// front-right-top corner. Third angle puts the top view above the front view and the right view to its
// right; first angle puts the top view below it and the right view to its left. The views in one
// column share their horizontal (model X) mapping, the views in one row their vertical (model Z), so
// they stay in projection with each other.
import type { HiddenLineView } from '@barocss/cad';
import type { DrawingSettings, DrawingViews, ViewId, XY } from './types';

export const VIEWS: Record<ViewId, HiddenLineView & { label: string }> = {
  front: { toward: [0, -1, 0], up: [0, 0, 1], label: 'FRONT' },
  top: { toward: [0, 0, 1], up: [0, 1, 0], label: 'TOP' },
  right: { toward: [1, 0, 0], up: [0, 0, 1], label: 'RIGHT' },
  iso: { toward: [1, -1, 1], up: [0, 0, 1], label: 'ISOMETRIC' },
};

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

export interface ViewPlacement { id: ViewId | 'section'; scale: number; origin: XY; box: [number, number, number, number] }
export interface SheetLayout {
  size: [number, number]; scale: number; fits: boolean;
  frame: [number, number, number, number];
  title: [number, number, number, number];
  views: Record<ViewId, ViewPlacement>;
  /** Section A–A: under the front view, in projection with it. */
  section?: ViewPlacement;
}

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

/** `section`: the extent of section A–A (view coordinates), when the sheet has one. */
export function layoutSheet(views: DrawingViews, settings: DrawingSettings, section?: { min: readonly number[]; max: readonly number[] }): SheetLayout {
  const [W, H] = SHEETS[settings.sheet];
  const frame: SheetLayout['frame'] = [MARGIN, MARGIN, W - MARGIN, H - MARGIN];
  const title: SheetLayout['title'] = [frame[2] - TITLE_BLOCK.width, frame[3] - TITLE_BLOCK.height, frame[2], frame[3]];
  // The drawing area: the frame above the title block's band.
  const area = [frame[0] + PAD, frame[1] + PAD, frame[2] - PAD, title[1] - PAD];
  const cells = CELLS[settings.projection];
  const ext = (id: ViewId) => ({ u: [views[id].min[0], views[id].max[0]], v: [views[id].min[1], views[id].max[1]] });
  // Column widths and row heights in model mm: a shared mapping spans the union of its views.
  const colU: [number, number][] = [[Infinity, -Infinity], [Infinity, -Infinity]], colW = [0, 0];
  const rowV: [number, number][] = [[Infinity, -Infinity], [Infinity, -Infinity]], rowH = [0, 0];
  const shared = (id: ViewId, list: ViewId[], col: boolean) => list.includes(id) && list.some(o => o !== id && cells[o][col ? 0 : 1] === cells[id][col ? 0 : 1]);
  for (const id of Object.keys(cells) as ViewId[]) {
    const [c, r] = cells[id], e = ext(id);
    if (shared(id, SHARED_U, true)) { colU[c] = [Math.min(colU[c][0], e.u[0]), Math.max(colU[c][1], e.u[1])]; }
    colW[c] = Math.max(colW[c], e.u[1] - e.u[0]);
    if (shared(id, SHARED_V, false)) { rowV[r] = [Math.min(rowV[r][0], e.v[0]), Math.max(rowV[r][1], e.v[1])]; }
    rowH[r] = Math.max(rowH[r], e.v[1] - e.v[0]);
  }
  for (const k of [0, 1]) { if (colU[k][0] < colU[k][1]) colW[k] = Math.max(colW[k], colU[k][1] - colU[k][0]); if (rowV[k][0] < rowV[k][1]) rowH[k] = Math.max(rowH[k], rowV[k][1] - rowV[k][0]); }
  // Section A–A takes a third row, under the front view's column.
  const secH = section ? section.max[1] - section.min[1] : 0, extraH = (s: number) => section ? s * secH + GAP : 0;
  const fitsAt = (s: number) => s * (colW[0] + colW[1]) + GAP <= area[2] - area[0] && s * (rowH[0] + rowH[1]) + GAP + extraH(s) <= area[3] - area[1];
  const scale = settings.scale ?? SCALES.find(fitsAt) ?? SCALES[SCALES.length - 1];
  const totalW = scale * (colW[0] + colW[1]) + GAP, totalH = scale * (rowH[0] + rowH[1]) + GAP + extraH(scale);
  const x0 = area[0] + Math.max(0, (area[2] - area[0] - totalW) / 2), y0 = area[1] + Math.max(0, (area[3] - area[1] - totalH) / 2);
  const colX = [x0, x0 + scale * colW[0] + GAP], rowY = [y0, y0 + scale * rowH[0] + GAP];
  const placed = {} as Record<ViewId, ViewPlacement>;
  for (const id of Object.keys(cells) as ViewId[]) {
    const [c, r] = cells[id], e = ext(id);
    const ox = shared(id, SHARED_U, true) ? colX[c] + scale * (colW[c] - (colU[c][1] - colU[c][0])) / 2 - scale * colU[c][0]
      : colX[c] + (scale * colW[c] - scale * (e.u[1] - e.u[0])) / 2 - scale * e.u[0];
    const oy = shared(id, SHARED_V, false) ? rowY[r] + scale * (rowH[r] - (rowV[r][1] - rowV[r][0])) / 2 + scale * rowV[r][1]
      : rowY[r] + (scale * rowH[r] - scale * (e.v[1] - e.v[0])) / 2 + scale * e.v[1];
    placed[id] = { id, scale, origin: [ox, oy], box: [ox + scale * e.u[0], oy - scale * e.v[1], ox + scale * e.u[1], oy - scale * e.v[0]] };
  }
  let sectionAt: ViewPlacement | undefined;
  if (section) {
    const ox = placed.front.origin[0], oy = rowY[1] + scale * rowH[1] + GAP + scale * section.max[1];
    sectionAt = { id: 'section', scale, origin: [ox, oy], box: [ox + scale * section.min[0], oy - scale * section.max[1], ox + scale * section.max[0], oy - scale * section.min[1]] };
  }
  return { size: [W, H], scale, fits: fitsAt(scale), frame, title, views: placed, ...(sectionAt ? { section: sectionAt } : {}) };
}
