// The drawing's issue list (R14.2, O3): what is wrong on the sheet and what is missing from it, each with where it
// is and, where one is safe, a fix. It is R14's "the drawing is right" check: a sheet with no errors reads cleanly,
// and with no warnings it dimensions every hole, step and overall size the views show.
//
// Wrong on the sheet (errors):
//   DIMENSION_LOST     a dimension's edge is gone or no longer shows as it did            fix: remove it
//   TEXT_OVERLAP       two annotations' texts overlap (dimensions, notes, view names)     fix: move one out
//   TEXT_OVER_LINES    a dimension's text lies over a view's lines or another dimension   fix: move it out
//   OFF_SHEET          an annotation reaches past the frame or into the title block       fix: move it in
//   VIEWS_DONT_FIT     the views do not fit the sheet at its scale                        fix: an automatic scale (or A3)
//   DATUM_LOST         a datum's edge is gone (R14.4)                                     fix: remove it
//   DATUM_TWICE        two datums with one letter                                         fix: remove the later
//   FRAME_LOST         a feature control frame's dimension is gone or lost               fix: remove it
//   DATUM_UNDEFINED    a frame refers to a datum the drawing does not have                (none: define it or edit the frame)
// Worth a check (warnings):
//   DUPLICATE          the same size given twice (in one view or two that share the axis) fix: remove the auto one or the later
//   REMATCHED          a reference was matched again after an edit: check it              fix: accept it as it is
//   HOLE_SIZE_MISSING  a hole without a diameter (or a callout for its kind of hole)     fix: Auto-dimension
//   HOLE_NOT_LOCATED   a hole whose position is not given across or up                   fix: Auto-dimension
//   STEP_NOT_LOCATED   a step's (an inner edge's) position not given                     fix: Auto-dimension
//   OVERALL_MISSING    the part's width, height or depth not given                         fix: Auto-dimension
//   VIEW_NEEDED        a hole shows round only in a view not shown (R14.3)                 fix: show the view
// Tables (O49) are annotations: TEXT_OVERLAP, TEXT_OVER_LINES (a view's lines or area) and OFF_SHEET, fix: move it
// (move-table); and an error of their own:
//   TABLE_SOURCE       a table's source is unknown or gave nothing (drawn with its reason)   (none: fix the part or the table)
import type { PartElement } from './elementCallouts';
import type { BrepProjection } from '@barocss/cad';
import { autoDimensions, axisOf, holesOf, levels } from './auto';
import { basicBox, buildSheet, datumMarks, dimensionMarks, frameMarks, placementOf, projectionOf, sectionExtents, tableRoom, type Mark, type MarkGroup, type Sheet, type SheetSection } from './sheet';
import { textCorners } from './text';
import { SCALES, layoutSheet, sectionDepth, type SheetLayout } from './views';
import { fmtMM, type Resolved } from './dimensions';
import { SECTION_VIEWS, VIEW_IDS, isSectionRef, nextSectionId, sectionLetter, sectionsOf, withSections, type DimPoint, type SectionViewId, type DimView, type DrawingDimension, type DrawingSettings, type DrawingViews, type ViewId, type XY } from './types';

export const DRAWING_ISSUES_VERSION = 'cad-studio-drawing-issues-v1';

export type DrawingIssueCode = 'DIM_ON_HIDDEN' | 'DATUM_LOST' | 'FRAME_LOST' | 'DATUM_UNDEFINED' | 'DATUM_TWICE' | 'VIEW_NEEDED' | 'DIMENSION_LOST' | 'TEXT_OVERLAP' | 'TEXT_OVER_LINES' | 'OFF_SHEET' | 'VIEWS_DONT_FIT' | 'DUPLICATE' | 'REMATCHED' | 'HOLE_SIZE_MISSING' | 'HOLE_NOT_LOCATED' | 'STEP_NOT_LOCATED' | 'OVERALL_MISSING' | 'TABLE_SOURCE' | 'WELD_NOT_SHOWN' | 'BALLOON_NOT_CLEAR' | 'BALLOON_NO_EDGE' | 'FIT_ROW_MISSING' | 'FOLLOWED_CHANGED';
export type DrawingFix =
  | { kind: 'remove'; dim: string }
  | { kind: 'move'; dim: string; place: XY }
  | { kind: 'move-note'; note: string; at: XY }
  /** A table's top-left corner to `at` (O49). */
  | { kind: 'move-table'; table: string; at: XY }
  | { kind: 'accept'; dim: string }
  | { kind: 'scale'; scale?: number; sheet?: 'A3' }
  | { kind: 'auto-dimension' }
  | { kind: 'show-view'; view: ViewId }
  | { kind: 'remove-datum'; datum: string }
  | { kind: 'remove-frame'; frame: string }
  /** O148 X3: a section the dimension needs (DIM_ON_HIDDEN): its letter, its view and its place along that view's depth. */
  | { kind: 'add-section'; id: string; view: SectionViewId; at: number };
export interface DrawingIssue {
  code: DrawingIssueCode;
  severity: 'error' | 'warning';
  message: string;
  /** The dimensions and notes it is about; `view`; `at`: a sheet point to show it at. */
  dims?: string[]; notes?: string[]; tables?: string[]; /** FRd2: the weld symbols (W-numbers) it is about. */ welds?: string[]; view?: DimView; at?: XY;
  fix?: DrawingFix;
}

const SAME = 1e-6;
/** Sheet mm two texts may come closer than before they count as overlapping (their boxes are generous). */
const CLEAR = 0.2;
/** How far a fix looks to move a dimension: this many 8 mm rows each way. */
const MOVE_ROWS = 6, ROW = 8;
const ORTHO: readonly ViewId[] = ['top', 'front', 'right'];

// ---------------------------------------------------------------------------------------------------------
// Boxes of text on the sheet

/** A text's box on the sheet (y down): its corners in order, from its baseline point, anchor, size and angle. */
export type Quad = [XY, XY, XY, XY];
export function textBox(m: Extract<Mark, { kind: 'text' }>): Quad { return textCorners(m.at, m.text, m.size, m.anchor, m.angle ?? 0, !!m.bold); }

function axesOf(q: Quad): XY[] { return [[q[1][0] - q[0][0], q[1][1] - q[0][1]], [q[3][0] - q[0][0], q[3][1] - q[0][1]]]; }
function project(q: Quad, ax: XY): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const p of q) { const t = p[0] * ax[0] + p[1] * ax[1]; if (t < lo) lo = t; if (t > hi) hi = t; }
  return [lo, hi];
}
/** Two boxes overlap by more than `clear` along every separating axis (the separating-axis test). */
export function quadsOverlap(a: Quad, b: Quad, clear = CLEAR): boolean {
  for (const ax of [...axesOf(a), ...axesOf(b)]) {
    const l = Math.hypot(ax[0], ax[1]); if (l < 1e-12) continue;
    const u: XY = [ax[0] / l, ax[1] / l], [a0, a1] = project(a, u), [b0, b1] = project(b, u);
    if (a1 - clear <= b0 || b1 - clear <= a0) return false;
  }
  return true;
}
/** Whether a segment passes through a box (shrunk by `clear`): clipped in the box's own frame. */
export function segmentHitsQuad(p: XY, q: XY, box: Quad, clear = CLEAR): boolean {
  const o = box[0], ex: XY = [box[1][0] - o[0], box[1][1] - o[1]], ey: XY = [box[3][0] - o[0], box[3][1] - o[1]];
  const lx = Math.hypot(ex[0], ex[1]), ly = Math.hypot(ey[0], ey[1]);
  if (lx < 1e-12 || ly < 1e-12) return false;
  const ux: XY = [ex[0] / lx, ex[1] / lx], uy: XY = [ey[0] / ly, ey[1] / ly];
  const loc = (r: XY): XY => [(r[0] - o[0]) * ux[0] + (r[1] - o[1]) * ux[1], (r[0] - o[0]) * uy[0] + (r[1] - o[1]) * uy[1]];
  const a = loc(p), b = loc(q), lo = [clear, clear], hi = [lx - clear, ly - clear];
  if (hi[0] <= lo[0] || hi[1] <= lo[1]) return false;
  let t0 = 0, t1 = 1;
  for (const k of [0, 1]) {
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-15) { if (a[k] < lo[k] || a[k] > hi[k]) return false; continue; }
    let ta = (lo[k] - a[k]) / d, tb = (hi[k] - a[k]) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** Segments in square cells (sheet mm), to test a box against only those near it. */
export class SegmentGrid {
  private readonly cells = new Map<number, number[]>();
  constructor(readonly segs: readonly (readonly [XY, XY])[], private readonly size = 10) {
    for (let i = 0; i < segs.length; i++) {
      const [p, q] = segs[i];
      const x0 = Math.floor(Math.min(p[0], q[0]) / size), x1 = Math.floor(Math.max(p[0], q[0]) / size), y0 = Math.floor(Math.min(p[1], q[1]) / size), y1 = Math.floor(Math.max(p[1], q[1]) / size);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = cellKey(x, y), c = this.cells.get(k); if (c) c.push(i); else this.cells.set(k, [i]); }
    }
  }
  /** Whether any segment crosses the segment p–q. */
  crosses(p: XY, q: XY): boolean {
    const seen = new Set<number>();
    for (let x = Math.floor(Math.min(p[0], q[0]) / this.size); x <= Math.floor(Math.max(p[0], q[0]) / this.size); x++) for (let y = Math.floor(Math.min(p[1], q[1]) / this.size); y <= Math.floor(Math.max(p[1], q[1]) / this.size); y++) {
      const c = this.cells.get(cellKey(x, y)); if (!c) continue;
      for (const i of c) { if (seen.has(i)) continue; seen.add(i); const [a, b] = this.segs[i]; if (segmentsCross(p, q, a, b)) return true; }
    }
    return false;
  }
  /** Whether any segment passes through the box. */
  hits(box: Quad): boolean {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of box) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const seen = new Set<number>();
    for (let x = Math.floor(x0 / this.size); x <= Math.floor(x1 / this.size); x++) for (let y = Math.floor(y0 / this.size); y <= Math.floor(y1 / this.size); y++) {
      const c = this.cells.get(cellKey(x, y)); if (!c) continue;
      for (const i of c) { if (seen.has(i)) continue; seen.add(i); const [p, q] = this.segs[i]; if (segmentHitsQuad(p, q, box)) return true; }
    }
    return false;
  }
}
/** Whether two segments cross (touching ends do not count). */
function segmentsCross(a: XY, b: XY, c: XY, d: XY): boolean {
  const o = (p: XY, q: XY, r: XY) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d), eps = 1e-12;
  return ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps));
}
/** A cell's key: x and y in 16 bits each (offset, so negatives fit). */
const cellKey = (x: number, y: number) => ((x + 32768) & 0xffff) * 65536 + ((y + 32768) & 0xffff);

/** A mark's straight pieces on the sheet (arcs in 16 pieces a half turn; text and fills none). */
function segments(m: Mark, out: [XY, XY][]): void {
  if (m.kind === 'line') out.push([m.a, m.b]);
  else if (m.kind === 'polyline') for (let i = 0; i + 1 < m.points.length; i++) out.push([m.points[i], m.points[i + 1]]);
  else if (m.kind === 'arc') {
    const n = Math.max(2, Math.ceil(Math.abs(m.t1 - m.t0) / (Math.PI / 16)));
    let prev: XY = [m.center[0] + m.u[0] * Math.cos(m.t0) + m.v[0] * Math.sin(m.t0), m.center[1] + m.u[1] * Math.cos(m.t0) + m.v[1] * Math.sin(m.t0)];
    for (let k = 1; k <= n; k++) {
      const t = m.t0 + (m.t1 - m.t0) * k / n, p: XY = [m.center[0] + m.u[0] * Math.cos(t) + m.v[0] * Math.sin(t), m.center[1] + m.u[1] * Math.cos(t) + m.v[1] * Math.sin(t)];
      out.push([prev, p]); prev = p;
    }
  }
}

interface Owner { kind: 'dimension' | 'note' | 'label' | 'datum' | 'table' | 'weld' | 'balloon'; id?: string; view?: DimView }
interface Placed { owner: Owner; boxes: Quad[]; lines: [XY, XY][]; points: XY[] }

function placedOf(g: MarkGroup): Placed {
  // (A table is one box, its texts and rules inside it: what must stay clear of it is the whole of it, O49.)
  if (g.role === 'table') {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const m of g.marks) for (const [x, y] of m.kind === 'text' ? textBox(m) : m.kind === 'line' ? [m.a, m.b] : []) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const box: Quad = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    return { owner: { kind: 'table', id: g.id }, boxes: [box], lines: [], points: [...box] };
  }
  const owner: Owner = g.role === 'dimension' ? { kind: 'dimension', id: g.id, view: g.view } : g.role === 'note' ? { kind: 'note', id: g.id } : g.role === 'datum' ? { kind: 'datum', id: g.id, view: g.view } : g.role === 'weld' ? { kind: 'weld', id: g.id, view: g.view } : g.role === 'balloon' ? { kind: 'balloon', id: g.id, view: g.view } : { kind: 'label', view: g.view };
  const boxes: Quad[] = [], lines: [XY, XY][] = [], points: XY[] = [];
  for (const m of g.marks) {
    if (m.kind === 'text') { const b = textBox(m); boxes.push(b); points.push(...b); }
    else { segments(m, lines); if (m.kind === 'fill') points.push(...m.points); }
  }
  for (const [p, q] of lines) points.push(p, q);
  return { owner, boxes, lines, points };
}

const same = (a: Owner, b: Owner) => a.kind === b.kind && a.id === b.id && a.view === b.view;
const name = (o: Owner, sheet: Sheet) => o.kind === 'dimension' ? `dimension ${textOf(sheet, o.id!)}` : o.kind === 'note' ? 'a note' : o.kind === 'table' ? `table ${o.id}` : o.kind === 'balloon' ? `balloon ${o.id}` : o.kind === 'weld' ? `weld symbol ${o.id}` : o.kind === 'datum' ? `datum ${datumLetter(sheet, o.id!)}` : `the ${o.view ?? 'section'} view’s name`;
function datumLetter(sheet: Sheet, id: string): string { const t = sheet.groups.find(g => g.role === 'datum' && g.id === id)?.marks.find(m => m.kind === 'text'); return t && t.kind === 'text' ? t.text : id; }
function textOf(sheet: Sheet, id: string): string { const r = sheet.dimensions.find(d => d.dim.id === id); return r?.ok ? r.text : id; }

// ---------------------------------------------------------------------------------------------------------
// The list

export interface IssueContext {
  views: DrawingViews; layout: SheetLayout; settings: DrawingSettings; sheet: Sheet; callout: (edge: string, diameterMM?: number) => string | null;
  /** O148 X2: the sections cut for the sheet (for Auto-dimension's fix). */
  sections?: readonly SheetSection[];
  /** O148 X3: the part's machine elements (a keyseat's shaft, a keyway's axis): the section a hidden dimension needs. */
  elements?: readonly PartElement[];
  /** D155: why a diameter dimension's fit class has no limits at its size (drawing/fits.ts fitMiss), or null. */
  fitMiss?: (edge: string, diameterMM: number) => string | null;
  /** FRf2 (O125): frames following a placed part's sketch that changed since linked, in words. */
  followedChanged?: readonly string[];
  /** The sheet built again for other settings (O67: a table's sheet or scale fix is offered only when that sheet clears it). */
  rebuild?: (settings: DrawingSettings) => IssueContext;
}

/** Whether a visible edge of the view ends at a point (model coordinates). */
function seenAt(pr: BrepProjection, p: readonly number[]): boolean {
  const u = p[0] * pr.right[0] + p[1] * pr.right[1] + p[2] * pr.right[2], v = p[0] * pr.up[0] + p[1] * pr.up[1] + p[2] * pr.up[2];
  for (const e of pr.edges) if (e.ends && e.pieces.some(x => x.visible)) for (const q of e.ends) {
    const qu = q[0] * pr.right[0] + q[1] * pr.right[1] + q[2] * pr.right[2], qv = q[0] * pr.up[0] + q[1] * pr.up[1] + q[2] * pr.up[2];
    if (Math.abs(qu - u) <= 1e-6 && Math.abs(qv - v) <= 1e-6) return true;
  }
  return false;
}
export function drawingIssues(ctx: IssueContext): DrawingIssue[] {
  const { layout, settings, sheet } = ctx, out: DrawingIssue[] = [];
  if (!layout.fits) {
    const next = settings.scale !== undefined ? { kind: 'scale' as const } : settings.sheet === 'A4' ? { kind: 'scale' as const, sheet: 'A3' as const } : undefined;
    out.push({ code: 'VIEWS_DONT_FIT', severity: 'error', message: `The views do not fit the ${settings.sheet} sheet at the scale${settings.scale !== undefined ? ' set' : ''}.`, ...(next ? { fix: next } : {}) });
  }
  // Datums and frames (R14.4, O5).
  const letters = new Map<string, string>();
  for (const d of settings.datums ?? []) {
    if (!layout.views[d.view].hidden && !datumMarks(layout, ctx.views, d)) out.push({ code: 'DATUM_LOST', severity: 'error', message: `Datum ${d.letter}: its edge in the ${d.view} view is no longer in the part.`, view: d.view, fix: { kind: 'remove-datum', datum: d.id } });
    if (letters.has(d.letter)) out.push({ code: 'DATUM_TWICE', severity: 'error', message: `Datum ${d.letter} is defined twice.`, view: d.view, fix: { kind: 'remove-datum', datum: d.id } });
    else letters.set(d.letter, d.id);
  }
  for (const f of settings.frames ?? []) {
    const r = sheet.dimensions.find(x => x.dim.id === f.dim);
    if (!r?.ok) { out.push({ code: 'FRAME_LOST', severity: 'error', message: `A position frame (Ø${f.value}) belongs to a dimension that is ${r ? 'lost' : 'gone'}.`, ...(r ? { dims: [f.dim] } : {}), fix: { kind: 'remove-frame', frame: f.id } }); continue; }
    const missing = f.datums.filter(l => !letters.has(l));
    if (missing.length) out.push({ code: 'DATUM_UNDEFINED', severity: 'error', message: `The position frame on ${r.text} refers to datum${missing.length > 1 ? 's' : ''} ${missing.join(', ')}, which the drawing does not have.`, dims: [f.dim], view: r.dim.view });
  }
  for (const r of sheet.dimensions) {
    if (!r.ok) { out.push({ code: 'DIMENSION_LOST', severity: 'error', message: `A ${r.dim.kind} dimension in ${viewName(r.dim.view)} is lost: ${r.reason}`, dims: [r.dim.id], view: r.dim.view, fix: { kind: 'remove', dim: r.dim.id } }); continue; }
    // (O146: a linear dimension measuring to a hidden line — a keyseat under its hub, say — is said; a section through it
    // would show it. No section is added here: that is R14's view logic, an open item.)
    if (r.dim.kind === 'linear') {
      // (A point is on a hidden line when no visible edge of the view ends there: a corner a hidden edge also ends at is seen.)
      const pr = projectionOf(ctx.views, ctx.sheet, r.dim.view);
      const on = pr ? [r.dim.a, r.dim.b].filter(p => p.at === 'end' && !seenAt(pr, p.near)) : [];
      // (O148 X3: a keyseat's or a keyway's — the section square to its axis through its middle, as the fix.)
      const sec = on.length ? sectionFor(ctx, r.dim) : null;
      if (on.length) out.push({ code: 'DIM_ON_HIDDEN', severity: 'warning', message: `Dimension ${r.text} measures to ${on.length > 1 ? 'hidden lines' : 'a hidden line'} in ${viewName(r.dim.view)}: ${sec?.text ?? 'a section through it would show it (none is added for it).'}`, dims: [r.dim.id], view: r.dim.view, ...(sec?.fix ? { fix: sec.fix } : {}) });
    }
    if (rematched(r.dim)) out.push({ code: 'REMATCHED', severity: 'warning', message: `Dimension ${r.text}: an edge it measures was matched again after an edit. Check it measures what you meant.`, dims: [r.dim.id], view: r.dim.view, fix: { kind: 'accept', dim: r.dim.id } });
  }
  // What lies on the sheet: annotations and the lines they must keep clear of.
  // (A feature control frame is part of its dimension: they overlap, are kept clear and move together.)
  // (FRf2, O125: a frame following a placed part's sketch that changed since linked: its geometry current, the link to renew.)
  for (const t of ctx.followedChanged ?? []) out.push({ code: 'FOLLOWED_CHANGED', severity: 'warning', message: `A frame ${t}.` });
  // (D155: a diameter's fit class with no row for its size in the user's tables: said, with what to load — never a guessed limit.)
  if (ctx.fitMiss) for (const r of sheet.dimensions) if (r.ok && r.kind === 'diameter') {
    const why = ctx.fitMiss(r.dim.edge, 2 * r.radius);
    if (why) out.push({ code: 'FIT_ROW_MISSING', severity: 'error', message: `Dimension ${r.text}: its tolerance class has no limits here — ${why.replace(/^\[FIT_TABLE_MISS\] /, '')}.`, dims: [r.dim.id], view: r.dim.view });
  }
  // (FRd2, O119: a weld seen in no view has no symbol: said, the weld list holds it.)
  if (sheet.welds?.unshown.length) out.push({ code: 'WELD_NOT_SHOWN', severity: 'warning', message: `Weld${sheet.welds.unshown.length > 1 ? 's' : ''} ${sheet.welds.unshown.join(', ')}: no edge of the joint is visible in the front, top or right view, so no symbol is drawn. The weld list holds ${sheet.welds.unshown.length > 1 ? 'them' : 'it'}; a section or a detail view would show ${sheet.welds.unshown.length > 1 ? 'them' : 'it'}.` });
  // (O147 B2: a balloon with no clear room, and a BOM line none of whose items shows an edge in the balloons' view.)
  if (sheet.balloons?.unclear.length) { const u = sheet.balloons.unclear, many = u.length > 1; out.push({ code: 'BALLOON_NOT_CLEAR', severity: 'warning', message: `Balloon${many ? 's' : ''} ${u.join(', ')}: no clear room beside the ${sheet.balloons.placed[0]?.view ?? 'iso'} view, so ${many ? 'they sit' : 'it sits'} at the nearest place, over other marks. A larger sheet or a smaller scale gives room.` }); }
  if (sheet.balloons?.noEdge.length) { const n = sheet.balloons.noEdge, many = n.length > 1; out.push({ code: 'BALLOON_NO_EDGE', severity: 'warning', message: `BOM line${many ? 's' : ''} ${n.join(', ')}: no edge of ${many ? 'their items is' : 'its item is'} visible in the ${settings.views && !settings.views.includes('iso') ? 'front' : 'iso'} view, so no balloon is drawn. The BOM table holds ${many ? 'them' : 'it'}.` }); }
  for (const tb of sheet.tables ?? []) if (tb.error) out.push({ code: 'TABLE_SOURCE', severity: 'error', message: `Table ${tb.id} has no rows from its source: ${tb.error}.`, tables: [tb.id] });
  const placed = sheet.groups.filter(g => g.role === 'dimension' || g.role === 'note' || g.role === 'label' || g.role === 'datum' || g.role === 'table' || g.role === 'weld' || g.role === 'balloon').map(g => g.role === 'dimension' ? placedOf({ ...g, marks: [...g.marks, ...sheet.groups.filter(c => c.role === 'control' && settings.frames?.some(f => f.id === c.id && f.dim === g.id)).flatMap(c => c.marks)] }) : placedOf(g));
  const viewLines: [XY, XY][] = [];
  for (const g of sheet.groups) if (g.role === 'view' || g.role === 'section') for (const m of g.marks) segments(m, viewLines);
  const viewGrid = new SegmentGrid(viewLines);
  const flagged = new Set<string>();
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    if (!a.boxes.some(x => b.boxes.some(y => quadsOverlap(x, y)))) continue;
    // The one to move: a dimension before a note before a view's name; the auto one, the later one.
    const mover = pickMover(a, b, settings);
    const key = `${mover.owner.kind}:${mover.owner.id}`;
    if (flagged.has(key) && mover.owner.kind !== 'label') continue; flagged.add(key);
    out.push({ code: 'TEXT_OVERLAP', severity: 'error', message: `The text of ${name(a.owner, sheet)} overlaps ${name(b.owner, sheet)}.`, ...ids([a, b]), at: center(mover.boxes[0]), ...fixFor(ctx, mover, placed, viewGrid) });
  }
  for (const p of placed) {
    if (p.owner.kind === 'label') {
      // A view's name sits under the dimensions below its view: pushed into the next view, it needs room, not a move.
      if (p.boxes.some(b => viewGrid.hits(b) || onOtherView(ctx.layout, b, p.owner.view))) out.push({ code: 'TEXT_OVER_LINES', severity: 'error', message: `${cap(name(p.owner, sheet))} lies over lines of the drawing: the dimensions under its view push it there (a larger sheet or a smaller scale gives room).`, ...(p.owner.view ? { view: p.owner.view } : {}), at: center(p.boxes[0]) });
      continue;
    }
    if (p.owner.kind === 'table') {
      if (!flagged.has(`table:${p.owner.id}`) && p.boxes.some(b => viewGrid.hits(b) || onOtherView(ctx.layout, b, undefined))) { flagged.add(`table:${p.owner.id}`); out.push({ code: 'TEXT_OVER_LINES', severity: 'error', message: `${cap(name(p.owner, sheet))} lies over a view of the drawing.`, ...ids([p]), at: center(p.boxes[0]), ...fixFor(ctx, p, placed, viewGrid) }); }
      continue;
    }
    if (p.owner.kind === 'weld' || p.owner.kind === 'balloon') {
      // (FRd2, and O147's balloons: a weld symbol's texts — its size and W-number — off the views' lines; its leader runs into its view by design.)
      if (!flagged.has(`weld:${p.owner.id}`) && p.boxes.some(b => viewGrid.hits(b) || onOtherView(ctx.layout, b, p.owner.view))) { flagged.add(`weld:${p.owner.id}`); out.push({ code: 'TEXT_OVER_LINES', severity: 'error', message: `${cap(name(p.owner, sheet))} lies over lines of the drawing.`, ...ids([p]), at: center(p.boxes[0]) }); }
      continue;
    }
    if (p.owner.kind !== 'dimension' || flagged.has(`dimension:${p.owner.id}`)) continue;
    const others = placed.filter(q => q !== p && (q.owner.kind === 'dimension' || q.owner.kind === 'weld' || q.owner.kind === 'balloon')).flatMap(q => q.lines);
    if (p.boxes.some(b => viewGrid.hits(b) || others.some(([s, t]) => segmentHitsQuad(s, t, b)) || onOtherView(ctx.layout, b, p.owner.view))) {
      flagged.add(`dimension:${p.owner.id}`);
      out.push({ code: 'TEXT_OVER_LINES', severity: 'error', message: `The text of ${name(p.owner, sheet)} lies over lines of the drawing.`, ...ids([p]), at: center(p.boxes[0]), ...fixFor(ctx, p, placed, viewGrid) });
    }
  }
  const [fx0, fy0, fx1, fy1] = layout.frame, [tx0, ty0, tx1, ty1] = layout.title;
  for (const p of placed) {
    if (p.owner.kind === 'label') continue;
    const off = p.points.some(([x, y]) => x < fx0 || x > fx1 || y < fy0 || y > fy1 || (x > tx0 && x < tx1 && y > ty0 && y < ty1));
    if (!off || flagged.has(`${p.owner.kind}:${p.owner.id}`)) continue;
    flagged.add(`${p.owner.kind}:${p.owner.id}`);
    out.push({ code: 'OFF_SHEET', severity: 'error', message: `${cap(name(p.owner, sheet))} reaches past the frame or into the title block.`, ...ids([p]), at: center(p.boxes[0] ?? [p.points[0], p.points[0], p.points[0], p.points[0]]), ...fixFor(ctx, p, placed, viewGrid) });
  }
  out.push(...duplicates(ctx), ...coverage(ctx));
  // (A table no fix clears — no room here, on A3 or at a smaller standard scale — said so, never left as if one might, O67.)
  for (const x of out) if (!x.fix && x.tables?.length && TABLE_CLASH.has(x.code)) x.message += ' Nothing clears it: the table has no room on this sheet, on A3 or at a smaller standard scale; make it smaller or show fewer views.';
  return out;
}

/**
 * O148 X3: the section a dimension on hidden lines needs, when it measures a keyseat or a keyway: square to the feature's
 * axis (the shaft's, read from its step's round edges; the keyway's report's), through the feature's middle along it
 * (its edges' ends), on the principal plane that axis is — a fix adding the next free letter (A only on the front: the
 * front's checkbox); or, a section already there, Auto-dimension; an axis along no principal axis said, with no fix.
 * Null when the dimension measures no such feature.
 */
export function sectionFor(ctx: IssueContext, dim: Extract<DrawingDimension, { kind: 'linear' }>): { text: string; fix?: DrawingFix } | null {
  const faces = [dim.a.edge, dim.b.edge].flatMap(e => e.split('|')).map(f => f.replace(/~sil\d*$/, '').replace(/(#\d+)+$/, ''));
  let point: readonly number[] | null = null, axis: readonly number[] | null = null, own = '';
  for (const f of faces) {
    const seat = /^(.+)\.keyseat(\d+)$/.exec(f), way = /^(.+)\.keyway$/.exec(f);
    if (seat) {
      const e = ctx.elements?.find(x => x.id === seat[1] && x.element.kind === 'shaft'), ks = e?.element.kind === 'shaft' ? e.element.report.keyseats.find(k => k.index === Number(seat[2])) : undefined;
      if (!ks) continue;
      const stepFace = `${seat[1]}.seat${ks.step}`, round = roundEdgeOf(ctx.views, stepFace);
      if (round) { point = round.center; axis = round.normal; own = f; break; }
    }
    if (way) {
      const e = ctx.elements?.find(x => x.id === way[1] && x.element.kind === 'keyway');
      if (e?.element.kind === 'keyway') { point = e.element.report.axisPoint; axis = e.element.report.axis; own = f; break; }
    }
  }
  if (!point || !axis) return null;
  const n = Math.hypot(axis[0], axis[1], axis[2]), u = axis.map(x => x / n), k = u.findIndex(x => Math.abs(Math.abs(x) - 1) < 1e-9);
  if (k < 0) return { text: 'its axis runs along none of X, Y and Z, so no principal section shows it (an aligned section is not drawn yet).' };
  // (Its middle along the axis: half way between the ends of its edges, in every standard view.)
  let lo = Infinity, hi = -Infinity;
  for (const id of ['front', 'top', 'right'] as const) for (const e of ctx.views[id].edges) if (e.ends && e.name.split('|').some(f => f.replace(/~sil\d*$/, '').replace(/(#\d+)+$/, '') === own)) for (const p of e.ends) { const t = (p[0] - point[0]) * u[0] + (p[1] - point[1]) * u[1] + (p[2] - point[2]) * u[2]; lo = Math.min(lo, t); hi = Math.max(hi, t); }
  if (!(lo <= hi)) return null;
  const mid = point[k] + u[k] * (lo + hi) / 2, view = SECTION_VIEWS.find(v => sectionDepth(v, ctx.settings.orientation).k === k)!, depth = sectionDepth(view, ctx.settings.orientation);
  const at = Math.round(depth.sign * mid * 1e6) / 1e6 + 0, list = sectionsOf(ctx.settings), there = list.find(x => x.view === view && Math.abs(x.at - at) < 1e-6);
  const axisName = 'XYZ'[k];
  if (there) return { text: `section ${there.id}–${there.id} through it shows it: Auto-dimension puts it there.`, fix: { kind: 'auto-dimension' } };
  const id = view === 'front' && !list.some(x => x.id === 'A') ? 'A' : nextSectionId([{ id: 'A', view: 'front', at: 0 }, ...list]);
  return { text: `section ${id}–${id}, square to its axis (${axisName}) through its middle (${axisName} ${fmtMM(mid)}), would show it — the fix adds it.`, fix: { kind: 'add-section', id, view, at } };
}
/** A round edge of a face in the standard views (its circle's centre and normal: a shaft step's axis). */
function roundEdgeOf(views: DrawingViews, face: string): { center: readonly number[]; normal: readonly number[] } | null {
  for (const id of ['front', 'top', 'right'] as const) for (const e of views[id].edges) if (e.circle && e.name.split('|').some(f => { const g = f.replace(/~sil\d*$/, '').replace(/(#\d+)+$/, ''); return g === face || g.startsWith(`${face}.`); })) return { center: e.circle.center, normal: e.circle.normal };
  return null;
}

/** Whether a text box lies on the area of a view other than `own` (the section's too; a note's every view). */
function onOtherView(layout: SheetLayout, b: Quad, own: DimView | undefined): boolean {
  const areas = (['front', 'top', 'right', 'iso'] as const).filter(v => v !== own && !layout.views[v].hidden).map(v => layout.views[v].box).concat((layout.sections ?? []).filter(x => `section:${x.section}` !== own).map(x => x.box));
  return areas.some(([x0, y0, x1, y1]) => quadsOverlap(b, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]));
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const center = (q: Quad): XY => [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
function ids(ps: Placed[]): { dims?: string[]; notes?: string[]; tables?: string[]; welds?: string[] } {
  const dims = ps.filter(p => p.owner.kind === 'dimension').map(p => p.owner.id!), notes = ps.filter(p => p.owner.kind === 'note').map(p => p.owner.id!), tables = ps.filter(p => p.owner.kind === 'table').map(p => p.owner.id!), welds = ps.filter(p => p.owner.kind === 'weld').map(p => p.owner.id!);
  return { ...(dims.length ? { dims } : {}), ...(notes.length ? { notes } : {}), ...(tables.length ? { tables } : {}), ...(welds.length ? { welds } : {}) };
}
function rematched(d: DrawingDimension): boolean {
  const point = (p: DimPoint) => p.was !== undefined || (p.ring ?? []).some(m => m.was !== undefined);
  return d.kind === 'linear' ? point(d.a) || point(d.b) : d.kind === 'angle' ? d.a.was !== undefined || d.b.was !== undefined : d.kind === 'pcd' ? d.ring.some(m => m.was !== undefined) : d.was !== undefined;
}
function pickMover(a: Placed, b: Placed, settings: DrawingSettings): Placed {
  // (FRd2: a weld symbol is placed by the sheet, with no move of its own — the other one moves.)
  const rank = (p: Placed) => p.owner.kind === 'dimension' ? (settings.dimensions.find(d => d.id === p.owner.id)?.auto ? 0 : 1) : p.owner.kind === 'note' || p.owner.kind === 'table' ? 2 : p.owner.kind === 'datum' ? 3 : p.owner.kind === 'weld' ? 5 : 4;
  const ra = rank(a), rb = rank(b);
  return ra < rb ? a : rb < ra ? b : b;
}

/** The table's issue codes that a sheet must be clear of for a fix to count. */
const TABLE_CLASH = new Set<DrawingIssueCode>(['TEXT_OVERLAP', 'TEXT_OVER_LINES', 'OFF_SHEET']);
/** A sheet or scale for a table that has no room where it is: tried in order, each built again and checked; none clear, undefined. */
const tried = new WeakMap<IssueContext, Map<string, DrawingFix | undefined>>();
function tableElsewhere(ctx: IssueContext, table: string): DrawingFix | undefined {
  if (!ctx.rebuild) return undefined;
  let seen = tried.get(ctx); if (!seen) tried.set(ctx, seen = new Map());
  if (seen.has(table)) return seen.get(table);
  const f = searchElsewhere(ctx, table); seen.set(table, f); return f;
}
function searchElsewhere(ctx: IssueContext, table: string): DrawingFix | undefined {
  if (!ctx.rebuild) return undefined;
  const tries: DrawingFix[] = [];
  // (A3 at the scale the views have now, then at A3's own; then each smaller standard scale on this sheet.)
  if (ctx.settings.sheet === 'A4') tries.push({ kind: 'scale', sheet: 'A3', scale: ctx.layout.scale }, { kind: 'scale', sheet: 'A3' });
  for (const s of SCALES) if (s < ctx.layout.scale) tries.push({ kind: 'scale', scale: s });
  for (const f of tries) {
    const next = ctx.rebuild(applyFix(ctx, f));
    // (Built without its own rebuild: the check does not search again.)
    if (next.layout.fits && !drawingIssues({ ...next, rebuild: undefined }).some(x => TABLE_CLASH.has(x.code) && x.tables?.includes(table))) return f;
  }
  return undefined;
}

/**
 * A place for an annotation clear of every other text, of the views' lines and inside the frame: a dimension moved
 * row by row outward (or inward) square to its line, a callout or note along its leader's way; none if nothing clears.
 */
function fixFor(ctx: IssueContext, p: Placed, placed: readonly Placed[], viewGrid: SegmentGrid): { fix?: DrawingFix } {
  if (p.owner.kind === 'label' || p.owner.kind === 'datum' || p.owner.kind === 'weld' || p.owner.kind === 'balloon') return {};
  const others = placed.filter(q => !same(q.owner, p.owner)), boxes = others.flatMap(q => q.boxes), lines = others.filter(q => q.owner.kind === 'dimension' || q.owner.kind === 'weld' || q.owner.kind === 'balloon').flatMap(q => q.lines);
  const [fx0, fy0, fx1, fy1] = ctx.layout.frame, [tx0, ty0, tx1, ty1] = ctx.layout.title;
  const clear = (q: Placed) => q.boxes.every(b => !boxes.some(o => quadsOverlap(b, o)) && !viewGrid.hits(b) && !lines.some(([s, t]) => segmentHitsQuad(s, t, b)) && !onOtherView(ctx.layout, b, p.owner.view))
    && q.points.every(([x, y]) => x >= fx0 && x <= fx1 && y >= fy0 && y <= fy1 && !(x > tx0 && x < tx1 && y > ty0 && y < ty1));
  if (p.owner.kind === 'table') {
    // (A table goes where an auto-placed one would: the first room clear of everything else, O49.)
    const at = tableRoom(ctx.layout, ctx.sheet, p.owner.id!);
    if (at) return { fix: { kind: 'move-table', table: p.owner.id!, at } };
    // (No room on this sheet at this scale — the views and the table cannot share it, O67: A3 at the same scale, else a
    // smaller standard scale here, whichever first leaves the table clear when the sheet is built again with it.)
    const other = tableElsewhere(ctx, p.owner.id!);
    return other ? { fix: other } : {};
  }
  if (p.owner.kind === 'note') {
    const n = ctx.settings.notes?.find(x => x.id === p.owner.id); if (!n) return {};
    for (let k = 1; k <= MOVE_ROWS; k++) for (const [dx, dy] of [[0, ROW * k], [0, -ROW * k], [ROW * k, 0], [-ROW * k, 0]]) {
      const shifted: Placed = { ...p, boxes: p.boxes.map(b => b.map(([x, y]) => [x + dx, y + dy]) as Quad), points: p.points.map(([x, y]) => [x + dx, y + dy] as XY) };
      if (clear(shifted)) return { fix: { kind: 'move-note', note: n.id, at: [n.at[0] + dx, n.at[1] + dy] } };
    }
    return {};
  }
  const r = ctx.sheet.dimensions.find((d): d is Extract<Resolved, { ok: true }> => d.ok && d.dim.id === p.owner.id);
  if (!r) return {};
  const v = placementOf(ctx.layout, ctx.sheet, r.dim.view), pr = projectionOf(ctx.views, ctx.sheet, r.dim.view);
  if (!v || !pr) return {};
  for (const place of candidates(r, v.scale, pr)) {
    // (The sheet's resolved dimension carries its shown text, callout and count included.)
    const moved = { ...r, dim: { ...r.dim, place } } as Extract<Resolved, { ok: true }>;
    // (Drawn as the sheet draws it: boxed if basic, its feature control frame under it.)
    const marks = dimensionMarks(v, moved); if (r.dim.basic) marks.push(...basicBox(marks));
    const frame = ctx.settings.frames?.find(f => f.dim === r.dim.id), main = marks.find((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
    if (frame && main) marks.push(...frameMarks(main, frame));
    if (clear(placedOf({ role: 'dimension', id: r.dim.id, view: r.dim.view, marks }))) return { fix: { kind: 'move', dim: r.dim.id, place } };
  }
  return {};
}

/** Whether new marks (a group about to be added) are clear of every text, line, other view and the title block, inside the frame. */
const sheetClear = new WeakMap<Sheet, { grid: SegmentGrid; boxes: Quad[] }>();
export function marksClear(ctx: IssueContext, marks: Mark[], view: ViewId): boolean {
  // (What the sheet holds, once a sheet: placing tries many spots.)
  let held = sheetClear.get(ctx.sheet);
  if (!held) {
    const placed = ctx.sheet.groups.filter(g => g.role === 'dimension' || g.role === 'note' || g.role === 'label' || g.role === 'datum' || g.role === 'control').map(placedOf);
    const lines: [XY, XY][] = [];
    for (const g of ctx.sheet.groups) if (g.role === 'view' || g.role === 'section' || g.role === 'dimension' || g.role === 'control' || g.role === 'datum') for (const m of g.marks) segments(m, lines);
    held = { grid: new SegmentGrid(lines), boxes: placed.flatMap(q => q.boxes) }; sheetClear.set(ctx.sheet, held);
  }
  const { grid, boxes } = held, me = placedOf({ role: 'datum', view, marks });
  const [fx0, fy0, fx1, fy1] = ctx.layout.frame, [tx0, ty0, tx1, ty1] = ctx.layout.title;
  // Its text and box clear of all; its leader and box lines clear of other texts.
  const shapes: Quad[] = [...me.boxes, ...marks.filter((m): m is Extract<Mark, { kind: 'polyline' }> => m.kind === 'polyline').map(m => [m.points[0], m.points[1], m.points[2], m.points[3]] as Quad)];
  return shapes.every(b => !boxes.some(o => quadsOverlap(b, o)) && !grid.hits(b) && !onOtherView(ctx.layout, b, view))
    && me.lines.every(([p, q]) => !boxes.some(b => segmentHitsQuad(p, q, b)) && !grid.crosses(p, q))
    && me.points.every(([x, y]) => x >= fx0 && x <= fx1 && y >= fy0 && y <= fy1 && !(x > tx0 && x < tx1 && y > ty0 && y < ty1));
}

/** Places to try for a dimension (view coordinates): rows each way square to a linear one, round the circle for a leader. */
function candidates(r: Extract<Resolved, { ok: true }>, scale: number, pr: BrepProjection): XY[] {
  const p = r.dim.place, out: XY[] = [];
  if (r.kind === 'linear') {
    const o = r.dim.orient, d: XY = o === 'horizontal' ? [1, 0] : o === 'vertical' ? [0, 1] : unit([r.b[0] - r.a[0], r.b[1] - r.a[1]]), n: XY = [-d[1], d[0]];
    // Further from the measured points first.
    const side = Math.sign((p[0] - r.a[0]) * n[0] + (p[1] - r.a[1]) * n[1]) || 1;
    for (let k = 1; k <= MOVE_ROWS; k++) for (const sg of [side, -side]) out.push([p[0] + sg * n[0] * ROW * k / scale, p[1] + sg * n[1] * ROW * k / scale]);
    // Then rows beside the view itself, either side (for one far off): the first 10 mm out, then 8 mm apart.
    const corners: XY[] = [[pr.min[0], pr.min[1]], [pr.max[0], pr.min[1]], [pr.max[0], pr.max[1]], [pr.min[0], pr.max[1]]];
    const along = corners.map(c => c[0] * n[0] + c[1] * n[1]), hi = Math.max(...along), lo = Math.min(...along);
    const mid: XY = [(r.a[0] + r.b[0]) / 2, (r.a[1] + r.b[1]) / 2], at = mid[0] * n[0] + mid[1] * n[1];
    for (let k = 0; k <= MOVE_ROWS + 2; k++) for (const [edge, sg] of [[hi, 1], [lo, -1]] as const) {
      const t = edge + sg * (10 + ROW * k) / scale - at;
      out.push([mid[0] + n[0] * t, mid[1] + n[1] * t]);
    }
    return out;
  }
  if (r.kind === 'angle') { for (let k = 1; k <= MOVE_ROWS; k++) out.push([r.vertex[0] + (p[0] - r.vertex[0]) * (1 + 0.25 * k), r.vertex[1] + (p[1] - r.vertex[1]) * (1 + 0.25 * k)]); return out; }
  // A leader: the text further out, then round the circle in eighths.
  const c = r.center, d0 = Math.atan2(p[1] - c[1], p[0] - c[0]), reach = Math.hypot(p[0] - c[0], p[1] - c[1]);
  for (let k = 0; k <= MOVE_ROWS; k++) for (let e = 0; e < 8; e++) {
    if (k === 0 && e === 0) continue;
    const a = d0 + (e % 2 ? 1 : -1) * Math.ceil(e / 2) * Math.PI / 4, l = reach + k * ROW / scale;
    out.push([c[0] + Math.cos(a) * l, c[1] + Math.sin(a) * l]);
  }
  return out;
}
const unit = (v: XY): XY => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

// ---------------------------------------------------------------------------------------------------------
// Duplicates and coverage


function duplicates(ctx: IssueContext): DrawingIssue[] {
  const out: DrawingIssue[] = [], seen = new Map<string, Extract<Resolved, { ok: true }>>();
  for (const r of ctx.sheet.dimensions) {
    if (!r.ok) continue;
    let key: string;
    if (r.kind === 'linear' && r.dim.orient !== 'aligned') {
      const k = r.dim.orient === 'horizontal' ? 0 : 1, lo = Math.min(r.a[k], r.b[k]), hi = Math.max(r.a[k], r.b[k]);
      // (Views sharing an axis share its coordinates: the front and top views' u, the front and right views' v.)
      key = `L|${axisOf(baseView(ctx.sheet, r.dim.view), k)}|${round(lo)}|${round(hi)}|${r.dim.count ?? 1}`;
    } else if (r.kind === 'diameter' || r.kind === 'radius') key = `C|${r.dim.view}|${round(r.center[0])}|${round(r.center[1])}|${round(r.radius)}`;
    else continue;
    const had = seen.get(key);
    if (!had) { seen.set(key, r); continue; }
    // (O148 X2: the same span on features with nothing in common — a hub's keyway and its shaft's keyseat — is two measurements.)
    if (had.kind === 'linear' && r.kind === 'linear' && disjoint(featuresOf(had.dim.a.edge, had.dim.b.edge), featuresOf(r.dim.a.edge, r.dim.b.edge))) continue;
    const drop = r.dim.auto && !had.dim.auto ? r : had.dim.auto && !r.dim.auto ? had : r;
    out.push({ code: 'DUPLICATE', severity: 'warning', message: `${r.text} is given twice (${twice(had.dim.view, r.dim.view)}).`, dims: [had.dim.id, r.dim.id], view: r.dim.view, fix: { kind: 'remove', dim: drop.dim.id } });
  }
  return out;
}
const round = (v: number) => Math.round(v / SAME) * SAME;
/**
 * O148 X2: the features two ends belong to (their faces' features, a placed part's prefix kept; a section's cut face left
 * out): the same span measured on a hub's keyway and on its shaft's keyseat is two measurements, not one given twice.
 */
function featuresOf(...edges: string[]): string[] {
  const out = new Set<string>();
  for (const e of edges) for (const f of e.split('|')) { const n = f.replace(/~sil\d*$/, ''), slash = n.lastIndexOf('/', n.indexOf('.')), dot = n.indexOf('.', slash + 1), id = dot < 0 ? n : n.slice(0, dot); if (!/^(.*\/)?section\d+$/.test(id)) out.add(id); }
  return [...out];
}
const disjoint = (a: readonly string[], b: readonly string[]) => a.length > 0 && b.length > 0 && !a.some(x => b.includes(x));
/** O148 X2: the view a dimension's coordinates are of — a section's own view (it is projected as that view). */
const baseView = (sheet: Pick<Sheet, 'sections'>, v: DimView): ViewId => isSectionRef(v) ? sheet.sections?.find(x => x.id === sectionLetter(v))?.view ?? 'front' : v;
/** A view or section as the issue list names it: `the front view`, `section B–B`. */
const viewName = (v: DimView) => isSectionRef(v) ? `section ${sectionLetter(v)}–${sectionLetter(v)}` : `the ${v} view`;
/** Where a dimension given twice is: `front and top view` as before, a section by its name. */
const twice = (a: DimView, b: DimView) => !isSectionRef(a) && !isSectionRef(b) ? `${a} and ${b} view` : `${isSectionRef(a) ? viewName(a) : `${a} view`} and ${isSectionRef(b) ? viewName(b) : `${b} view`}`;

/** Coordinates a view's linear dimensions give along an axis: their ends, and the positions a counted pitch reaches. */
function givenAlong(sheet: Sheet, axis: string): number[] {
  const out: number[] = [];
  for (const r of sheet.dimensions) {
    if (!r.ok || r.kind !== 'linear' || r.dim.orient === 'aligned') continue;
    const k = r.dim.orient === 'horizontal' ? 0 : 1;
    if (axisOf(baseView(sheet, r.dim.view), k) !== axis) continue;
    out.push(r.a[k], r.b[k]);
    if (r.dim.count) { const step = r.b[k] - r.a[k]; for (let j = 2; j <= r.dim.count; j++) out.push(r.a[k] + step * j); }
  }
  return out;
}
const covers = (xs: readonly number[], x: number) => xs.some(y => Math.abs(y - x) <= 1e-6 * Math.max(1, Math.abs(x)));

function coverage(ctx: IssueContext): DrawingIssue[] {
  const { views, sheet } = ctx, out: DrawingIssue[] = [], auto: DrawingFix = { kind: 'auto-dimension' };
  const along: Record<string, number[]> = {};
  const given = (axis: string) => along[axis] ??= givenAlong(sheet, axis);
  // Holes: a size (its own diameter, or a counted one of its kind), and a position both ways in its view.
  const holes = holesOf(views, ctx.callout);
  const sizes = sheet.dimensions.filter((r): r is Extract<Resolved, { ok: true; kind: 'diameter' | 'radius' }> => r.ok && (r.kind === 'diameter' || r.kind === 'radius'));
  const kindOf = (callout: string | null, radius: number) => (callout ?? `Ø${round(2 * radius)}`).replace(/^\d+× /, '');
  let unsized = 0, unlocated = 0; const where: ViewId[] = [];
  const rings = sheet.dimensions.filter((r): r is Extract<Resolved, { ok: true; kind: 'pcd' }> => r.ok && r.kind === 'pcd');
  const hiddenOwners = new Map<ViewId, number>();
  for (const h of holes) {
    if (ctx.layout.views[h.view].hidden) { hiddenOwners.set(h.view, (hiddenOwners.get(h.view) ?? 0) + 1); continue; }
    const own = sizes.some(r => r.dim.view === h.view && Math.abs(r.center[0] - h.at[0]) <= SAME && Math.abs(r.center[1] - h.at[1]) <= SAME && Math.abs(r.radius - h.radius) <= SAME);
    const ofKind = sizes.some(r => r.dim.count && Math.abs(r.radius - h.radius) <= SAME && kindOf(ctx.callout(r.dim.kind === 'diameter' || r.dim.kind === 'radius' ? r.dim.edge : ''), r.radius) === kindOf(h.callout, h.radius));
    // (A counterbore's or countersink's outer circle: sized by the callout on its centre.)
    const inCallout = sizes.some(r => r.dim.view === h.view && Math.abs(r.center[0] - h.at[0]) <= SAME && Math.abs(r.center[1] - h.at[1]) <= SAME && r.radius < h.radius && /CBORE|CSK/.test(r.text));
    if (!own && !ofKind && !inCallout) { unsized++; where.push(h.view); }
    const pr = views[h.view];
    // (A hole of a pitch circle is located by the circle's centre, R14.5.)
    const ring = rings.find(r => r.dim.view === h.view && r.members.some(m => Math.abs(m[0] - h.at[0]) <= SAME && Math.abs(m[1] - h.at[1]) <= SAME));
    const at = ring ? ring.center : h.at;
    for (const k of [0, 1] as const) {
      if (Math.abs(at[k] - pr.min[k]) <= SAME || Math.abs(at[k] - pr.max[k]) <= SAME) continue;
      if (!covers(given(axisOf(h.view, k)), at[k])) { unlocated++; where.push(h.view); break; }
    }
  }
  for (const [view, n] of hiddenOwners) out.push({ code: 'VIEW_NEEDED', severity: 'warning', message: `${n} hole${n > 1 ? 's show' : ' shows'} round only in the ${view} view, which is not shown.`, view, fix: { kind: 'show-view', view } });
  if (unsized) out.push({ code: 'HOLE_SIZE_MISSING', severity: 'warning', message: `${unsized} hole${unsized > 1 ? 's have' : ' has'} no size on the drawing.`, view: where[0], fix: auto });
  if (unlocated) out.push({ code: 'HOLE_NOT_LOCATED', severity: 'warning', message: `${unlocated} hole${unlocated > 1 ? 's are' : ' is'} not located (a position across or up is missing).`, view: where[0], fix: auto });
  // Steps: inner edge positions (top: both ways; front: heights), as Auto-dimension gives them.
  let steps = 0;
  for (const [view, ks] of [['top', [0, 1]], ['front', [1]]] as const) {
    const pr: BrepProjection = views[view];
    for (const k of ks) {
      const xs = levels(pr, k).map(m => m.x).filter(x => x > pr.min[k] + SAME && x < pr.max[k] - SAME);
      const distinct = xs.sort((a, b) => a - b).filter((x, i) => !i || x - xs[i - 1] > SAME);
      steps += distinct.filter(x => !covers(given(axisOf(view, k)), x)).length;
    }
  }
  if (steps) out.push({ code: 'STEP_NOT_LOCATED', severity: 'warning', message: `${steps} step${steps > 1 ? 's are' : ' is'} not located (an inner edge’s position is missing).`, fix: auto });
  // Overall sizes: width (X), height (Z), depth (Y), each as one linear dimension over the whole extent in a view showing it.
  const missing: string[] = [];
  for (const [axis, label] of [['X', 'width'], ['Z', 'height'], ['Y', 'depth']] as const) {
    const has = ORTHO.some(view => ([0, 1] as const).some(k => {
      if (axisOf(view, k) !== axis) return false;
      const pr = views[view], ext = k === 0 ? pr.max[0] - pr.min[0] : pr.max[1] - pr.min[1];
      return sheet.dimensions.some(r => r.ok && r.kind === 'linear' && r.dim.view === view && r.dim.orient === (k === 0 ? 'horizontal' : 'vertical') && Math.abs(r.value - ext) <= 1e-6 * Math.max(1, ext));
    }));
    // (A round outline's size is its diameter.)
    const round = ORTHO.some(view => sizes.some(r => r.dim.view === view && Math.abs(2 * r.radius - (views[view].max[0] - views[view].min[0])) <= 1e-6 * Math.max(1, 2 * r.radius)));
    if (!has && !round) missing.push(label);
  }
  if (missing.length) out.push({ code: 'OVERALL_MISSING', severity: 'warning', message: `The part’s overall ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} not given.`, fix: auto });
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Fixes

/** The settings with one fix applied. */
export function applyFix(ctx: IssueContext, fix: DrawingFix): DrawingSettings {
  const s = ctx.settings;
  switch (fix.kind) {
    case 'remove': return { ...s, dimensions: s.dimensions.filter(d => d.id !== fix.dim), ...(s.frames?.some(f => f.dim === fix.dim) ? { frames: s.frames.filter(f => f.dim !== fix.dim) } : {}) };
    case 'remove-datum': return { ...s, datums: (s.datums ?? []).filter(d => d.id !== fix.datum) };
    case 'add-section': return sectionsOf(s).some(x => x.id === fix.id) ? s : withSections(s, [...sectionsOf(s), { id: fix.id, view: fix.view, at: fix.at }]);
    case 'remove-frame': return { ...s, frames: (s.frames ?? []).filter(f => f.id !== fix.frame) };
    case 'move': return { ...s, dimensions: s.dimensions.map(d => d.id === fix.dim ? { ...d, place: fix.place } : d) };
    case 'move-note': return { ...s, notes: (s.notes ?? []).map(n => n.id === fix.note ? { ...n, at: fix.at } : n) };
    case 'move-table': return { ...s, tables: (s.tables ?? []).map(x => (x.id === fix.table ? { ...x, at: fix.at, corner: 'top-left' as const } : x)) };
    case 'accept': return { ...s, dimensions: s.dimensions.map(d => d.id === fix.dim ? accepted(d) : d) };
    case 'scale': { const { scale: _drop, ...rest } = s; void _drop; return { ...rest, ...(fix.scale !== undefined && SCALES.includes(fix.scale) ? { scale: fix.scale } : {}), ...(fix.sheet ? { sheet: fix.sheet } : {}) }; }
    case 'auto-dimension': return { ...s, dimensions: autoDimensions(ctx.views, ctx.layout, s, ctx.callout, [], ctx.sections).dimensions };
    case 'show-view': { if (!s.views || s.views.includes(fix.view)) return s; const views = [...s.views, fix.view]; return { ...s, views: VIEW_IDS.filter(v => views.includes(v)) }; }
  }
}
function accepted(d: DrawingDimension): DrawingDimension {
  const clean = <T extends { was?: string }>(x: T): T => { const { was: _w, ...rest } = x; void _w; return rest as T; };
  const point = (p: DimPoint): DimPoint => ({ ...clean(p), ...(p.ring ? { ring: p.ring.map(clean) } : {}) });
  if (d.kind === 'pcd') return { ...d, ring: d.ring.map(clean) };
  if (d.kind === 'linear') return { ...d, a: point(d.a), b: point(d.b) };
  if (d.kind === 'angle') { const { was: _a, ...a } = d.a, { was: _b, ...b } = d.b; void _a; void _b; return { ...d, a, b }; }
  const { was: _w, ...rest } = d; void _w; return rest as DrawingDimension;
}

/** What a sheet is built from, to build it again after a fix. */
export interface SheetInputs { views: DrawingViews; settings: DrawingSettings; /** The part's machine elements (O145): Auto layout's leader notes for keys and pins. */ elements?: readonly PartElement[]; callout: (edge: string, diameterMM?: number) => string | null; fitMiss?: (edge: string, diameterMM: number) => string | null; followedChanged?: readonly string[]; meta: Omit<Parameters<typeof buildSheet>[3], 'callout'>; /** O148 X1: the sections cut (each with its projection; those the settings list are drawn). */ sections?: readonly SheetSection[] }

/** The context of a sheet built from its inputs (its layout from the settings, the sections' extents with it). */
export function issueContext(i: SheetInputs): IssueContext {
  const layout = layoutSheet(i.views, i.settings, sectionExtents(i.settings, i.sections));
  const sheet = buildSheet(i.views, layout, i.settings, { ...i.meta, callout: i.callout }, i.sections);
  return { views: i.views, layout, settings: i.settings, sheet, callout: i.callout, ...(i.sections ? { sections: i.sections } : {}), ...(i.elements ? { elements: i.elements } : {}), ...(i.fitMiss ? { fitMiss: i.fitMiss } : {}), ...(i.followedChanged?.length ? { followedChanged: i.followedChanged } : {}), rebuild: settings => issueContext({ ...i, settings }) };
}

/**
 * Every fix applied, one at a time and the sheet built again after each (a fix can clear or make others): the errors'
 * first, then the warnings'. Stops when nothing fixable is left, when a fix changes nothing, or after `max` fixes.
 * Returns the settings and what is left.
 */
/** `only`: the fixes to apply (all by default). */
export function fixAll(i: SheetInputs, max = 40, only: (fix: DrawingFix, issue: DrawingIssue) => boolean = () => true): { settings: DrawingSettings; applied: DrawingFix[]; left: DrawingIssue[] } {
  let settings = i.settings, ctx = issueContext(i), issues = drawingIssues(ctx);
  const applied: DrawingFix[] = [], tried = new Set<string>();
  for (let n = 0; n < max; n++) {
    const next = [...issues.filter(x => x.severity === 'error'), ...issues.filter(x => x.severity === 'warning')].find(x => x.fix && only(x.fix, x) && !tried.has(JSON.stringify(x.fix)));
    if (!next) break;
    const key = JSON.stringify(next.fix); tried.add(key);
    const changed = applyFix(ctx, next.fix!);
    if (JSON.stringify(changed) === JSON.stringify(settings)) continue;
    settings = changed; applied.push(next.fix!);
    ctx = issueContext({ ...i, settings }); issues = drawingIssues(ctx);
  }
  return { settings, applied, left: issues };
}
