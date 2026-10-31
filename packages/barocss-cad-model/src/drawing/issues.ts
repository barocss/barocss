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
//   DATUM_UNDEFINED    a frame refers to a datum no datum feature or datum target set has  (none: define it or edit the frame)
//   FRAME_RULE         a frame breaks a Y14.5 / ISO 1101 rule (a datum on a form tolerance, a profile composite that is not a refinement ...)  (none: edit the frame)
// Worth a check (warnings):
//   DUPLICATE          the same size given twice (in one view or two that share the axis) fix: remove the auto one or the later
//   REMATCHED          a reference was matched again after an edit: check it              fix: accept it as it is
//   HOLE_SIZE_MISSING  a hole without a diameter (or a callout for its kind of hole)     fix: Auto-dimension
//   HOLE_NOT_LOCATED   a hole whose position is not given across or up                   fix: Auto-dimension
//   STEP_NOT_LOCATED   a step's (an inner edge's) position not given                     fix: Auto-dimension
//   OVERALL_MISSING    the part's width, height or depth not given                         fix: Auto-dimension
//   VIEW_NEEDED        a hole shows round only in a view not shown (R14.3)                 fix: show the view
//   DATUM_TARGET_OUTSIDE  a line or area datum target (placed by view points) lies partly outside the part as the view shows it  (none: move it)
// Tables (O49) are annotations: TEXT_OVERLAP, TEXT_OVER_LINES (a view's lines or area) and OFF_SHEET, fix: move it
// (move-table); and an error of their own:
//   TABLE_SOURCE       a table's source is unknown or gave nothing (drawn with its reason)   (none: fix the part or the table)
import type { FastenerSizes } from '../app/fasteners';
import type { PartElement } from './elementCallouts';
import type { BrepProjection } from '@barocss/cad';
import { autoDimensions, axisOf, holesOf, levels, type Hole } from './auto';
import { sameLinearDependency, samePointDependency } from './measurement';
import { datumTargetConflicts, resolveDatumTarget, type DatumTargetFailureCode } from './datumTargets';
import { basicBox, buildSheet, datumMarks, dimensionMarks, frameMarks, placementOf, projectionOf, sectionExtents, tableRoom, type Mark, type MarkGroup, type Sheet, type SheetSection } from './sheet';
import { textCorners } from './text';
import { SCALES, layoutSheet, scaleLabel, sectionDepth, type SheetLayout } from './views';
import { detailScale } from './detail';
import { viewBreaksOf } from './breaks';
import { frameRules } from './controls';
import { fmtMM, type Resolved } from './dimensions';
import { SECTION_VIEWS, VIEW_IDS, baseViewOf, detailLetter, isDetailRef, isViewId, isSectionRef, nextSectionId, sectionLetter, sectionsOf, withSections, type DimPoint, type SectionViewId, type DimView, type DrawingDimension, type DrawingSettings, type DrawingViews, type ViewId, type XY } from './types';

export const DRAWING_ISSUES_VERSION = 'cad-studio-drawing-issues-v1';

export type DrawingIssueCode = 'DIM_ON_HIDDEN' | 'DATUM_LOST' | 'FRAME_LOST' | 'FRAME_VIEW_MISSING' | 'DATUM_UNDEFINED' | 'FRAME_RULE' | 'DATUM_TWICE' | 'VIEW_NEEDED' | 'DIMENSION_LOST' | 'TEXT_OVERLAP' | 'TEXT_OVER_LINES' | 'OFF_SHEET' | 'VIEWS_DONT_FIT' | 'DUPLICATE' | 'REMATCHED' | 'HOLE_SIZE_MISSING' | 'HOLE_NOT_LOCATED' | 'STEP_NOT_LOCATED' | 'OVERALL_MISSING' | 'TABLE_SOURCE' | 'WELD_NOT_SHOWN' | 'BALLOON_NOT_CLEAR' | 'BALLOON_NO_EDGE' | 'FIT_ROW_MISSING' | 'FOLLOWED_CHANGED' | 'DETAIL_PARENT_MISSING' | 'DETAIL_EMPTY' | 'DETAIL_NO_ROOM' | 'BREAK_NO_VIEW' | 'SECTION_NO_ROOM' | 'SECTION_NO_VIEW' | 'DATUM_TARGET_OUTSIDE' | DatumTargetFailureCode;
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
  /** DR-1: a detail whose parent is gone or whose circle holds nothing. */
  | { kind: 'remove-detail'; detail: string }
  /** DR-2: a break that crosses no shown view, by its place in the list. */
  | { kind: 'remove-break'; index: number }
  /** O148 X3: a section the dimension needs (DIM_ON_HIDDEN): its letter, its view and its place along that view's depth. */
  | { kind: 'add-section'; id: string; view: SectionViewId; at: number; /** O178: an aligned section's plane normal. */ dir?: [number, number, number] };
export interface DrawingIssue {
  code: DrawingIssueCode;
  severity: 'error' | 'warning';
  message: string;
  /** The dimensions and notes it is about; `view`; `at`: a sheet point to show it at. */
  dims?: string[]; notes?: string[]; tables?: string[]; datumTargets?: string[]; frames?: string[]; /** FRd2: the weld symbols (W-numbers) it is about. */ welds?: string[]; view?: DimView; at?: XY;
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

interface Owner { kind: 'dimension' | 'note' | 'label' | 'datum' | 'table' | 'weld' | 'balloon' | 'frame'; id?: string; view?: DimView; datumTarget?: true }
interface Placed { owner: Owner; boxes: Quad[]; lines: [XY, XY][]; points: XY[] }

function placedOf(g: MarkGroup): Placed {
  // (A table is one box, its texts and rules inside it: what must stay clear of it is the whole of it, O49.)
  if (g.role === 'table') {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const m of g.marks) for (const [x, y] of m.kind === 'text' ? textBox(m) : m.kind === 'line' ? [m.a, m.b] : []) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const box: Quad = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    return { owner: { kind: 'table', id: g.id }, boxes: [box], lines: [], points: [...box] };
  }
  const owner: Owner = g.standaloneFrame ? { kind: 'frame', id: g.id, view: g.view } : g.role === 'dimension' ? { kind: 'dimension', id: g.id, view: g.view } : g.role === 'note' ? { kind: 'note', id: g.id } : g.role === 'datum' ? { kind: 'datum', id: g.id, view: g.view, ...(g.datumTarget ? { datumTarget: true as const } : {}) } : g.role === 'weld' ? { kind: 'weld', id: g.id, view: g.view } : g.role === 'balloon' ? { kind: 'balloon', id: g.id, view: g.view } : { kind: 'label', view: g.view };
  const boxes: Quad[] = [], lines: [XY, XY][] = [], points: XY[] = [];
  for (const m of g.marks) {
    if (m.kind === 'text') { const b = textBox(m); boxes.push(b); points.push(...b); }
    else { segments(m, lines); if (m.kind === 'fill') points.push(...m.points); }
  }
  for (const [p, q] of lines) points.push(p, q);
  return { owner, boxes, lines, points };
}

const same = (a: Owner, b: Owner) => a.kind === b.kind && a.id === b.id && a.view === b.view && a.datumTarget === b.datumTarget;
const ownerKey = (o: Owner) => `${o.datumTarget ? 'datum-target' : o.kind}:${o.id}`;
const name = (o: Owner, sheet: Sheet) => o.kind === 'frame' ? 'a standalone feature control frame' : o.kind === 'dimension' ? `dimension ${textOf(sheet, o.id!)}` : o.kind === 'note' ? 'a note' : o.kind === 'table' ? `table ${o.id}` : o.kind === 'balloon' ? `balloon ${o.id}` : o.kind === 'weld' ? `weld symbol ${o.id}` : o.kind === 'datum' ? `datum${o.datumTarget ? ' target' : ''} ${datumLetter(sheet, o.id!, o.datumTarget)}` : `the ${o.view ?? 'section'} view’s name`;
function datumLetter(sheet: Sheet, id: string, target?: true): string { const t = sheet.groups.find(g => g.role === 'datum' && g.id === id && g.datumTarget === target)?.marks.find(m => m.kind === 'text'); return t && t.kind === 'text' ? t.text : id; }
function textOf(sheet: Sheet, id: string): string { const r = sheet.dimensions.find(d => d.dim.id === id); return r?.ok ? r.text : id; }

// ---------------------------------------------------------------------------------------------------------
// The list

export interface IssueContext {
  views: DrawingViews; layout: SheetLayout; settings: DrawingSettings; sheet: Sheet; callout: (edge: string, diameter?: number) => string | null;
  /** Authored identity for a combined hole callout; text equality cannot establish it. */
  locationOwner?: (edge: string) => string | null;
  /** O7: the document's fastener sizes, which position tolerances read (none loaded: each an estimate). */
  fastenerSizes?: FastenerSizes;
  /** O148 X2: the sections cut for the sheet (for Auto-dimension's fix). */
  sections?: readonly SheetSection[];
  /** O148 X3: the part's machine elements (a keyseat's shaft, a keyway's axis): the section a hidden dimension needs. */
  elements?: readonly PartElement[];
  /** D155: why a diameter dimension's fit class has no limits at its size (drawing/fits.ts fitMiss), or null. */
  fitMiss?: (edge: string, diameter: number) => string | null;
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
    if (!layout.views[d.view].hidden && !datumMarks(layout, ctx.views, d)) out.push({ code: 'DATUM_LOST', severity: 'error', message: d.face ? `Datum ${d.letter}: its face in the ${d.view} view has no unique current boundary anchor.` : `Datum ${d.letter}: its edge in the ${d.view} view is no longer in the part.`, view: d.view, fix: { kind: 'remove-datum', datum: d.id } });
    if (letters.has(d.letter)) out.push({ code: 'DATUM_TWICE', severity: 'error', message: `Datum ${d.letter} is defined twice.`, view: d.view, fix: { kind: 'remove-datum', datum: d.id } });
    else letters.set(d.letter, d.id);
  }
  const targetConflicts = datumTargetConflicts(settings.datumTargets ?? []);
  for (const d of settings.datumTargets ?? []) {
    const result = targetConflicts.has(d) ? { ok: false as const, code: 'DATUM_TARGET_DUPLICATE' as const, reason: 'The datum target id or letter-number is defined more than once.' } : resolveDatumTarget(ctx.views[d.view], d);
    if (!result.ok) out.push({ code: result.code, severity: 'error', message: `Datum target ${d.letter}${d.number}: ${result.reason}`, datumTargets: [d.id], view: d.view });
    else if (layout.views[d.view].hidden) out.push({ code: 'VIEW_NEEDED', severity: 'warning', message: `Datum target ${d.letter}${d.number}: its ${d.view} view is not shown.`, datumTargets: [d.id], view: d.view });
    else if (d.kind === 'line' || d.kind === 'area') {
      // Line and area targets are placed by view points and follow no geometry: say when they no longer lie on the part.
      const pr = ctx.views[d.view], pts: XY[] = d.kind === 'line' ? [d.line.from, d.line.to]
        : d.area.shape === 'circle' ? [[d.area.at[0] - d.area.d / 2, d.area.at[1] - d.area.d / 2], [d.area.at[0] + d.area.d / 2, d.area.at[1] + d.area.d / 2]]
        : [[d.area.at[0] - d.area.w / 2, d.area.at[1] - d.area.h / 2], [d.area.at[0] + d.area.w / 2, d.area.at[1] + d.area.h / 2]];
      const eps = 1e-6;
      if (pts.some(p => p[0] < pr.min[0] - eps || p[0] > pr.max[0] + eps || p[1] < pr.min[1] - eps || p[1] > pr.max[1] + eps))
        out.push({ code: 'DATUM_TARGET_OUTSIDE', severity: 'warning', message: `Datum target ${d.letter}${d.number}: its ${d.kind === 'line' ? 'line' : 'area'} lies partly outside the part in the ${d.view} view. It is placed by view points and does not follow the part; move it.`, datumTargets: [d.id], view: d.view });
    }
  }
  // (A datum exists when a datum feature symbol or a datum target set has its letter.)
  const known = new Set([...letters.keys(), ...(settings.datumTargets ?? []).map(t => t.letter)]);
  for (const f of settings.frames ?? []) {
    for (const why of frameRules(f)) out.push({ code: 'FRAME_RULE', severity: 'error', message: `The ${f.characteristic} frame${f.dim === undefined ? '' : ` on dimension ${f.dim}`}: ${why}`, frames: [f.id], ...(f.dim === undefined ? { view: f.view } : { dims: [f.dim] }) });
    if (f.dim === undefined) {
      const placement = placementOf(layout, sheet, f.view), projection = projectionOf(ctx.views, sheet, f.view);
      if (!placement || !projection) out.push({ code: 'FRAME_VIEW_MISSING', severity: 'error', message: `A standalone ${f.characteristic} frame has no current ${viewName(f.view)}. The saved frame is retained.`, frames: [f.id], view: f.view });
      else if (placement.hidden) out.push({ code: 'VIEW_NEEDED', severity: 'warning', message: `A standalone ${f.characteristic} frame is in ${viewName(f.view)}, which is not shown.`, frames: [f.id], view: f.view });
      const missing = [...new Set([...f.datums, ...(f.composite?.datums ?? []), ...(f.stacked?.datums ?? [])])].filter(l => !known.has(l));
      if (missing.length) out.push({ code: 'DATUM_UNDEFINED', severity: 'error', message: `A standalone ${f.characteristic} frame refers to datum${missing.length > 1 ? 's' : ''} ${missing.join(', ')}, which the drawing does not have.`, frames: [f.id], view: f.view });
      continue;
    }
    const r = sheet.dimensions.find(x => x.dim.id === f.dim);
    if (!r?.ok) { out.push({ code: 'FRAME_LOST', severity: 'error', message: `A ${f.characteristic} frame (${f.characteristic === 'position' ? 'Ø' : ''}${f.value}) belongs to a dimension that is ${r ? 'lost' : 'gone'}.`, ...(r ? { dims: [f.dim] } : {}), fix: { kind: 'remove-frame', frame: f.id } }); continue; }
    const missing = [...new Set([...f.datums, ...(f.composite?.datums ?? []), ...(f.stacked?.datums ?? [])])].filter(l => !known.has(l));
    if (missing.length) out.push({ code: 'DATUM_UNDEFINED', severity: 'error', message: `The ${f.characteristic} frame on ${r.text} refers to datum${missing.length > 1 ? 's' : ''} ${missing.join(', ')}, which the drawing does not have.`, dims: [f.dim], view: r.dim.view });
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
  // (O147 B2: a balloon with no clear room, and a BOM line none of whose items shows an edge in any shown base view.)
  if (sheet.balloons?.unclear.length) {
    const u = sheet.balloons.unclear, many = u.length > 1;
    const views = [...new Set(sheet.balloons.placed.filter(p => u.includes(p.no)).map(p => p.view))];
    const beside = views.length ? `the ${views.join(', ')} view${views.length > 1 ? 's' : ''}` : 'the assigned views';
    out.push({ code: 'BALLOON_NOT_CLEAR', severity: 'warning', message: `Balloon${many ? 's' : ''} ${u.join(', ')}: no clear room beside ${beside}, so ${many ? 'they sit' : 'it sits'} at the nearest place, over other marks. A larger sheet or a smaller scale gives room.` });
  }
  if (sheet.balloons?.noEdge.length) {
    const n = sheet.balloons.noEdge, many = n.length > 1;
    const shown = (['iso', 'front', 'top', 'right'] as const).filter(view => !layout.views[view].hidden);
    const where = shown.length ? `in the ${shown[0]} view${shown.length > 1 ? ` or any other shown base view (${shown.slice(1).join(', ')})` : ''}` : 'on this sheet because no base view is shown';
    out.push({ code: 'BALLOON_NO_EDGE', severity: 'warning', message: `BOM line${many ? 's' : ''} ${n.join(', ')}: no edge of ${many ? 'their items is' : 'its item is'} visible ${where}, so no balloon is drawn. The BOM table holds ${many ? 'them' : 'it'}.` });
  }
  // (DR-1: a detail whose parent is not on the sheet, whose circle holds nothing, or with no free room.)
  for (const m of sheet.detailsMissing ?? []) {
    const d = settings.details?.find(x => x.id === m.id), parent = d ? (d.view.startsWith('section:') ? `section ${d.view.slice(8)}–${d.view.slice(8)}` : `the ${d.view} view`) : 'its parent';
    if (m.why === 'parent') out.push({ code: 'DETAIL_PARENT_MISSING', severity: 'error', message: `Detail ${m.id}: ${parent} is not on the sheet, so the detail is not drawn.`, fix: { kind: 'remove-detail', detail: m.id } });
    else if (m.why === 'empty') out.push({ code: 'DETAIL_EMPTY', severity: 'warning', message: `Detail ${m.id}: its circle on ${parent} holds no line of the part.`, view: `detail:${m.id}`, fix: { kind: 'remove-detail', detail: m.id } });
    else out.push({ code: 'DETAIL_NO_ROOM', severity: 'error', message: `Detail ${m.id}: no free room on the sheet for it at ${scaleLabel(detailScale(d ?? {}, ctx.layout.scale))}. A larger sheet, a smaller scale for it, or placing it by hand gives room.` });
  }
  // (DR-4: a removed section with no free room; a revolved one with no view to be drawn on.)
  for (const m of sheet.sectionsMissing ?? []) {
    const x = sectionsOf(settings).find(y => y.id === m.id);
    if (m.why === 'room') out.push({ code: 'SECTION_NO_ROOM', severity: 'error', message: `Section ${m.id}–${m.id} (removed): no free room on the sheet for it at ${scaleLabel(x?.removed?.scale ?? ctx.layout.scale)}. A larger sheet, a smaller scale for it, or placing it by hand gives room.` });
    else out.push({ code: 'SECTION_NO_VIEW', severity: 'error', message: `Section ${m.id}–${m.id} (revolved): no view shows its plane edge-on to turn it onto, so it is not drawn. A removed section shows the same cut face.` });
  }
  // (DR-2: a break that shortens no shown orthographic view: its band misses the part, or only hidden views show its axis.)
  (settings.breaks ?? []).forEach((b, index) => {
    if ((['front', 'top', 'right'] as const).some(id => !ctx.layout.views[id].hidden && viewBreaksOf(ctx.views[id], [b]).length)) return;
    out.push({ code: 'BREAK_NO_VIEW', severity: 'warning', message: `The break along ${b.axis.toUpperCase()} from ${fmtMM(b.from)} to ${fmtMM(b.to)} shortens no view: it misses the part, or no view shown has its axis across or up.`, fix: { kind: 'remove-break', index } });
  });
  for (const tb of sheet.tables ?? []) if (tb.error) out.push({ code: 'TABLE_SOURCE', severity: 'error', message: `Table ${tb.id} has no rows from its source: ${tb.error}.`, tables: [tb.id] });
  const placed = sheet.groups.filter(g => g.standaloneFrame || g.role === 'dimension' || g.role === 'note' || g.role === 'label' || g.role === 'datum' || g.role === 'table' || g.role === 'weld' || g.role === 'balloon').map(g => g.role === 'dimension' ? placedOf({ ...g, marks: [...g.marks, ...sheet.groups.filter(c => c.role === 'control' && settings.frames?.some(f => f.id === c.id && f.dim === g.id)).flatMap(c => c.marks)] }) : placedOf(g));
  const viewLines: [XY, XY][] = [];
  for (const g of sheet.groups) if (g.role === 'view' || g.role === 'section' || g.role === 'detail') for (const m of g.marks) segments(m, viewLines);
  const viewGrid = new SegmentGrid(viewLines);
  const flagged = new Set<string>();
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    if (!a.boxes.some(x => b.boxes.some(y => quadsOverlap(x, y)))) continue;
    // The one to move: a dimension before a note before a view's name; the auto one, the later one.
    const mover = pickMover(a, b, settings);
    const key = ownerKey(mover.owner);
    if (flagged.has(key) && mover.owner.kind !== 'label') continue; flagged.add(key);
    out.push({ code: 'TEXT_OVERLAP', severity: 'error', message: `The text of ${name(a.owner, sheet)} overlaps ${name(b.owner, sheet)}.`, ...ids([a, b]), at: center(mover.boxes[0]), ...fixFor(ctx, mover, placed, viewGrid) });
  }
  for (const p of placed) {
    if (p.owner.kind === 'frame') {
      if (!flagged.has(ownerKey(p.owner)) && p.boxes.some(b => viewGrid.hits(b) || placed.some(q => q !== p && q.lines.some(([s, t]) => segmentHitsQuad(s, t, b))) || onOtherView(ctx.layout, ctx.sheet, b, p.owner.view))) {
        flagged.add(ownerKey(p.owner));
        out.push({ code: 'TEXT_OVER_LINES', severity: 'error', message: 'The text of a standalone feature control frame lies over lines of the drawing.', ...ids([p]), at: center(p.boxes[0]) });
      }
      continue;
    }
    if (p.owner.kind === 'label') {
      // A view's name sits under the dimensions below its view: pushed into the next view, it needs room, not a move.
      if (p.boxes.some(b => viewGrid.hits(b) || onOtherView(ctx.layout, ctx.sheet, b, p.owner.view))) out.push({ code: 'TEXT_OVER_LINES', severity: 'error', message: `${cap(name(p.owner, sheet))} lies over lines of the drawing: the dimensions under its view push it there (a larger sheet or a smaller scale gives room).`, ...(p.owner.view ? { view: p.owner.view } : {}), at: center(p.boxes[0]) });
      continue;
    }
    if (p.owner.kind === 'table') {
      if (!flagged.has(`table:${p.owner.id}`) && p.boxes.some(b => viewGrid.hits(b) || onOtherView(ctx.layout, ctx.sheet, b, undefined))) { flagged.add(`table:${p.owner.id}`); out.push({ code: 'TEXT_OVER_LINES', severity: 'error', message: `${cap(name(p.owner, sheet))} lies over a view of the drawing.`, ...ids([p]), at: center(p.boxes[0]), ...fixFor(ctx, p, placed, viewGrid) }); }
      continue;
    }
    if (p.owner.kind === 'weld' || p.owner.kind === 'balloon') {
      // (FRd2, and O147's balloons: a weld symbol's texts — its size and W-number — off the views' lines; its leader runs into its view by design.)
      if (!flagged.has(`weld:${p.owner.id}`) && p.boxes.some(b => viewGrid.hits(b) || onOtherView(ctx.layout, ctx.sheet, b, p.owner.view))) { flagged.add(`weld:${p.owner.id}`); out.push({ code: 'TEXT_OVER_LINES', severity: 'error', message: `${cap(name(p.owner, sheet))} lies over lines of the drawing.`, ...ids([p]), at: center(p.boxes[0]) }); }
      continue;
    }
    if (p.owner.kind !== 'dimension' || flagged.has(`dimension:${p.owner.id}`)) continue;
    const others = placed.filter(q => q !== p && (q.owner.kind === 'dimension' || q.owner.kind === 'weld' || q.owner.kind === 'balloon')).flatMap(q => q.lines);
    if (p.boxes.some(b => viewGrid.hits(b) || others.some(([s, t]) => segmentHitsQuad(s, t, b)) || onOtherView(ctx.layout, ctx.sheet, b, p.owner.view))) {
      flagged.add(`dimension:${p.owner.id}`);
      out.push({ code: 'TEXT_OVER_LINES', severity: 'error', message: `The text of ${name(p.owner, sheet)} lies over lines of the drawing.`, ...ids([p]), at: center(p.boxes[0]), ...fixFor(ctx, p, placed, viewGrid) });
    }
  }
  const [fx0, fy0, fx1, fy1] = layout.frame, [tx0, ty0, tx1, ty1] = layout.title;
  for (const p of placed) {
    if (p.owner.kind === 'label') continue;
    const off = p.points.some(([x, y]) => x < fx0 || x > fx1 || y < fy0 || y > fy1 || (x > tx0 && x < tx1 && y > ty0 && y < ty1));
    if (!off || flagged.has(ownerKey(p.owner))) continue;
    flagged.add(ownerKey(p.owner));
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
  if (k < 0) return alignedSectionFor(ctx, point, u, own);
  // (Its middle along the axis: half way between the ends of its edges, in every standard view.)
  let lo = Infinity, hi = -Infinity;
  for (const id of ['front', 'top', 'right'] as const) for (const e of ctx.views[id].edges) if (e.ends && e.name.split('|').some(f => f.replace(/~sil\d*$/, '').replace(/(#\d+)+$/, '') === own)) for (const p of e.ends) { const t = (p[0] - point[0]) * u[0] + (p[1] - point[1]) * u[1] + (p[2] - point[2]) * u[2]; lo = Math.min(lo, t); hi = Math.max(hi, t); }
  if (!(lo <= hi)) return null;
  const mid = point[k] + u[k] * (lo + hi) / 2, view = SECTION_VIEWS.find(v => sectionDepth(v, ctx.settings.orientation).k === k)!, depth = sectionDepth(view, ctx.settings.orientation);
  const at = Math.round(depth.sign * mid * 1e6) / 1e6 + 0, list = sectionsOf(ctx.settings), there = list.find(x => x.view === view && Math.abs(x.at - at) < 1e-6);
  const axisName = 'XYZ'[k];
  if (there) return { text: `section ${there.id}–${there.id} through it shows it: Auto-dimension puts it there.`, fix: { kind: 'auto-dimension' } };
  const id = view === 'front' && !list.some(x => x.id === 'A') && !ctx.settings.details?.some(d => d.id === 'A') ? 'A' : nextSectionId([{ id: 'A', view: 'front', at: 0 }, ...list], (ctx.settings.details ?? []).map(d => d.id));
  return { text: `section ${id}–${id}, square to its axis (${axisName}) through its middle (${axisName} ${fmtMM(mid)}), would show it — the fix adds it.`, fix: { kind: 'add-section', id, view, at } };
}
/**
 * O178: a feature whose axis runs along none of X, Y and Z — a keyway in a tilted bore — is shown by an aligned section,
 * the plane square to its axis through its middle: laid out as the principal view's whose depth is nearest the axis,
 * its normal the axis turned to that depth's side. A section already there (the same plane): Auto-dimension.
 */
function alignedSectionFor(ctx: IssueContext, point: readonly number[], u: readonly number[], own: string): { text: string; fix?: DrawingFix } | null {
  let lo = Infinity, hi = -Infinity;
  for (const id of ['front', 'top', 'right'] as const) for (const e of ctx.views[id].edges) if (e.ends && e.name.split('|').some(f => f.replace(/~sil\d*$/, '').replace(/(#\d+)+$/, '') === own)) for (const p of e.ends) { const t = (p[0] - point[0]) * u[0] + (p[1] - point[1]) * u[1] + (p[2] - point[2]) * u[2]; lo = Math.min(lo, t); hi = Math.max(hi, t); }
  if (!(lo <= hi)) return null;
  // (The view: the principal one whose depth lies nearest the axis; the normal on that depth's side, so it is seen as that view is.)
  const view = SECTION_VIEWS.reduce((best, v) => Math.abs(dotOf(sectionDepth(v, ctx.settings.orientation).d, u)) > Math.abs(dotOf(sectionDepth(best, ctx.settings.orientation).d, u)) ? v : best, SECTION_VIEWS[0]);
  const side = dotOf(sectionDepth(view, ctx.settings.orientation).d, u) < 0 ? -1 : 1, r6 = (x: number) => Math.round(x * 1e6) / 1e6 + 0;
  const dir: [number, number, number] = [r6(side * u[0]), r6(side * u[1]), r6(side * u[2])], mid = (lo + hi) / 2;
  const n = Math.hypot(dir[0], dir[1], dir[2]), at = r6(((point[0] + u[0] * mid) * dir[0] + (point[1] + u[1] * mid) * dir[1] + (point[2] + u[2] * mid) * dir[2]) / n);
  const list = sectionsOf(ctx.settings), there = list.find(x => x.dir && Math.abs(dotOf(x.dir, dir) / (Math.hypot(...x.dir) * n) - 1) < 1e-9 && Math.abs(x.at - at) < 1e-6);
  if (there) return { text: `aligned section ${there.id}–${there.id} through it shows it: Auto-dimension puts it there.`, fix: { kind: 'auto-dimension' } };
  const id = nextSectionId([{ id: 'A', view: 'front', at: 0 }, ...list], (ctx.settings.details ?? []).map(d => d.id));
  return { text: `its axis runs along none of X, Y and Z: an aligned section ${id}–${id}, square to its axis through its middle, would show it — the fix adds it.`, fix: { kind: 'add-section', id, view, at, dir } };
}
const dotOf = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A round edge of a face in the standard views (its circle's centre and normal: a shaft step's axis). */
function roundEdgeOf(views: DrawingViews, face: string): { center: readonly number[]; normal: readonly number[] } | null {
  for (const id of ['front', 'top', 'right'] as const) for (const e of views[id].edges) if (e.circle && e.name.split('|').some(f => { const g = f.replace(/~sil\d*$/, '').replace(/(#\d+)+$/, ''); return g === face || g.startsWith(`${face}.`); })) return { center: e.circle.center, normal: e.circle.normal };
  return null;
}

/**
 * Whether a text box lies on the area of a view other than `own` (the section's too; a note's every view). DR-4: a removed
 * section's area counts as a view's; a revolved one lies on its view, whose area is then its own too.
 */
function onOtherView(layout: SheetLayout, sheet: Pick<Sheet, 'details' | 'sections'>, b: Quad, own: DimView | undefined): boolean {
  const host = sheet.sections?.find(x => x.form === 'revolved' && `section:${x.id}` === own)?.on;
  const areas = (['front', 'top', 'right', 'iso'] as const).filter(v => v !== own && v !== host && !layout.views[v].hidden).map(v => layout.views[v].box).concat((layout.sections ?? []).filter(x => `section:${x.section}` !== own).map(x => x.box), (sheet.sections ?? []).filter(x => x.form === 'removed' && `section:${x.id}` !== own).map(x => x.placement.box), (sheet.details ?? []).filter(x => `detail:${x.id}` !== own).map(x => x.placement.box));
  return areas.some(([x0, y0, x1, y1]) => quadsOverlap(b, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]));
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const center = (q: Quad): XY => [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
function ids(ps: Placed[]): { dims?: string[]; notes?: string[]; tables?: string[]; welds?: string[]; datumTargets?: string[]; frames?: string[] } {
  const dims = ps.filter(p => p.owner.kind === 'dimension').map(p => p.owner.id!), notes = ps.filter(p => p.owner.kind === 'note').map(p => p.owner.id!), tables = ps.filter(p => p.owner.kind === 'table').map(p => p.owner.id!), welds = ps.filter(p => p.owner.kind === 'weld').map(p => p.owner.id!);
  const datumTargets = ps.filter(p => p.owner.datumTarget).map(p => p.owner.id!);
  const frames = ps.filter(p => p.owner.kind === 'frame').map(p => p.owner.id!);
  return { ...(dims.length ? { dims } : {}), ...(notes.length ? { notes } : {}), ...(tables.length ? { tables } : {}), ...(welds.length ? { welds } : {}), ...(datumTargets.length ? { datumTargets } : {}), ...(frames.length ? { frames } : {}) };
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
  if (p.owner.kind === 'frame' || p.owner.kind === 'label' || p.owner.kind === 'datum' || p.owner.kind === 'weld' || p.owner.kind === 'balloon') return {};
  const others = placed.filter(q => !same(q.owner, p.owner)), boxes = others.flatMap(q => q.boxes), lines = others.filter(q => q.owner.kind === 'dimension' || q.owner.kind === 'weld' || q.owner.kind === 'balloon').flatMap(q => q.lines);
  const [fx0, fy0, fx1, fy1] = ctx.layout.frame, [tx0, ty0, tx1, ty1] = ctx.layout.title;
  const clear = (q: Placed) => q.boxes.every(b => !boxes.some(o => quadsOverlap(b, o)) && !viewGrid.hits(b) && !lines.some(([s, t]) => segmentHitsQuad(s, t, b)) && !onOtherView(ctx.layout, ctx.sheet, b, p.owner.view))
    // A moved dimension's extensions and leaders must also clear the texts that stay in place.
    && (q.owner.kind !== 'dimension' || q.lines.every(([s, t]) => !boxes.some(b => segmentHitsQuad(s, t, b))))
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
  for (const place of candidates(r, v.scale, pr, Math.hypot(fx1 - fx0, fy1 - fy0))) {
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
    for (const g of ctx.sheet.groups) if (g.role === 'view' || g.role === 'section' || g.role === 'detail' || g.role === 'dimension' || g.role === 'control' || g.role === 'datum') for (const m of g.marks) segments(m, lines);
    held = { grid: new SegmentGrid(lines), boxes: placed.flatMap(q => q.boxes) }; sheetClear.set(ctx.sheet, held);
  }
  const { grid, boxes } = held, me = placedOf({ role: 'datum', view, marks });
  const [fx0, fy0, fx1, fy1] = ctx.layout.frame, [tx0, ty0, tx1, ty1] = ctx.layout.title;
  // Its text and box clear of all; its leader and box lines clear of other texts.
  const shapes: Quad[] = [...me.boxes, ...marks.filter((m): m is Extract<Mark, { kind: 'polyline' }> => m.kind === 'polyline').map(m => [m.points[0], m.points[1], m.points[2], m.points[3]] as Quad)];
  return shapes.every(b => !boxes.some(o => quadsOverlap(b, o)) && !grid.hits(b) && !onOtherView(ctx.layout, ctx.sheet, b, view))
    && me.lines.every(([p, q]) => !boxes.some(b => segmentHitsQuad(p, q, b)) && !grid.crosses(p, q))
    && me.points.every(([x, y]) => x >= fx0 && x <= fx1 && y >= fy0 && y <= fy1 && !(x > tx0 && x < tx1 && y > ty0 && y < ty1));
}

/** Places to try for a dimension (view coordinates): rows each way square to a linear one, round the circle for a leader. */
function candidates(r: Extract<Resolved, { ok: true }>, scale: number, pr: BrepProjection, maxReach: number): XY[] {
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
    // Keep the established candidates first, then fill the gaps and search farther in sheet mm.
    // Only the normal component moves a linear dimension; its measurement direction stays fixed.
    for (let mm = 2; mm <= maxReach; mm += 2) for (const sg of [side, -side]) {
      if (mm <= ROW * MOVE_ROWS && mm % ROW === 0) continue;
      out.push([p[0] + sg * n[0] * mm / scale, p[1] + sg * n[1] * mm / scale]);
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
  const out: DrawingIssue[] = [], seen = new Map<string, Extract<Resolved, { ok: true }>[]>();
  for (const r of ctx.sheet.dimensions) {
    if (!r.ok) continue;
    let key: string;
    if (r.kind === 'linear' && r.dim.orient !== 'aligned') {
      const k = r.dim.orient === 'horizontal' ? 0 : 1, lo = Math.min(r.a[k], r.b[k]), hi = Math.max(r.a[k], r.b[k]);
      // (Views sharing an axis share its coordinates: the front and top views' u, the front and right views' v.)
      key = `L|${axisOf(baseView(ctx.sheet, r.dim.view), k)}|${round(lo)}|${round(hi)}|${r.dim.count ?? 1}`;
    } else if (r.kind === 'diameter' || r.kind === 'radius') key = `C|${r.dim.view}|${round(r.center[0])}|${round(r.center[1])}|${round(r.radius)}`;
    else continue;
    const bucket = seen.get(key) ?? [];
    let had: Extract<Resolved, { ok: true }> | undefined;
    for (const previous of bucket) {
      if (previous.kind !== 'linear' || r.kind !== 'linear') { had = previous; break; }
      const pv = projectionOf(ctx.views, ctx.sheet, previous.dim.view), rv = projectionOf(ctx.views, ctx.sheet, r.dim.view);
      if (pv && rv && sameLinearDependency(previous, pv, r, rv, axisOf(baseView(ctx.sheet, r.dim.view), r.dim.orient === 'horizontal' ? 0 : 1), ctx.locationOwner)) { had = previous; break; }
    }
    if (!had) { bucket.push(r); seen.set(key, bucket); continue; }
    const drop = r.dim.auto && !had.dim.auto ? r : had.dim.auto && !r.dim.auto ? had : r;
    out.push({ code: 'DUPLICATE', severity: 'warning', message: `${r.text} is given twice (${twice(had.dim.view, r.dim.view)}).`, dims: [had.dim.id, r.dim.id], view: r.dim.view, fix: { kind: 'remove', dim: drop.dim.id } });
  }
  return out;
}
const round = (v: number) => Math.round(v / SAME) * SAME;
/** O148 X2: the view a dimension's coordinates are of — a section's own view (it is projected as that view). */
const baseView = (sheet: Pick<Sheet, 'sections' | 'details'>, v: DimView): ViewId => baseViewOf(v, sheet.sections ?? [], sheet.details ?? []);
/** A view or section as the issue list names it: `the front view`, `section B–B`. */
const viewName = (v: DimView) => isSectionRef(v) ? `section ${sectionLetter(v)}–${sectionLetter(v)}` : isDetailRef(v) ? `detail ${detailLetter(v)}` : `the ${v} view`;
/** Where a dimension given twice is: `front and top view` as before, a section by its name. */
const twice = (a: DimView, b: DimView) => isViewId(a) && isViewId(b) ? `${a} and ${b} view` : `${isViewId(a) ? `${a} view` : viewName(a)} and ${isViewId(b) ? `${b} view` : viewName(b)}`;

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

/** How near a view's extents must come to a circle's diameter for it to be the view's round outline (relative, O174). */
const OUTLINE_REL = 1e-4;
function targetLocated(ctx: IssueContext, target: DimPoint, view: ViewId, at: XY, k: 0 | 1): boolean {
  const axis = axisOf(view, k), pr = ctx.views[view];
  for (const r of ctx.sheet.dimensions) {
    if (!r.ok || r.kind !== 'linear' || r.dim.orient === 'aligned') continue;
    const rk = r.dim.orient === 'horizontal' ? 0 : 1;
    if (axisOf(baseView(ctx.sheet, r.dim.view), rk) !== axis) continue;
    const source = projectionOf(ctx.views, ctx.sheet, r.dim.view); if (!source) continue;
    if (samePointDependency(r.dim.a, source, target, pr, axis, ctx.locationOwner) || samePointDependency(r.dim.b, source, target, pr, axis, ctx.locationOwner)) return true;
    if (r.dim.count && r.dim.view === view && r.dim.a.at === 'center' && r.dim.b.at === 'center') {
      const row = Math.abs(r.a[1 - k] - at[1 - k]) <= SAME && Math.abs(r.b[1 - k] - at[1 - k]) <= SAME;
      const pattern = samePointDependency(r.dim.a, source, target, pr, axis, ctx.locationOwner, true) && samePointDependency(r.dim.b, source, target, pr, axis, ctx.locationOwner, true);
      if (!row && !pattern) continue;
      const step = r.b[k] - r.a[k];
      for (let j = 2; j <= r.dim.count; j++) if (covers([r.a[k] + step * j], at[k])) return true;
    }
  }
  return false;
}
function holeLocated(ctx: IssueContext, h: Hole, ring: Extract<Resolved, { ok: true; kind: 'pcd' }> | undefined, at: XY, k: 0 | 1, holes: readonly Hole[]): boolean {
  if (!ring) return targetLocated(ctx, h.ref, h.view, at, k);
  const first = ring.dim.ring[0];
  if (first && targetLocated(ctx, { edge: first.edge, near: first.near, at: 'pcd', ring: ring.dim.ring }, h.view, at, k)) return true;
  // A PCD's centre can be explicitly located by the bore drawn on that centre.
  for (const other of holes) if (other.view === h.view && Math.abs(other.at[0] - at[0]) <= SAME && Math.abs(other.at[1] - at[1]) <= SAME && targetLocated(ctx, other.ref, h.view, at, k)) return true;
  return false;
}

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
  // (O174, F8: a view whose outline is itself a full circle — a shaft or a cover seen end on — locates every circle on its
  // centre by that alone: the outline's, the steps', a bore's, a gland's; there is no edge to measure them from.)
  const outlineOf = new Map<ViewId, XY>();
  for (const h of holes) {
    const pr = views[h.view];
    // (The view's extents are of its curves as drawn, to their chord: the diameter matched to OUTLINE_REL of it.)
    const tol = Math.max(SAME, OUTLINE_REL * 2 * h.radius);
    if (Math.abs(2 * h.radius - (pr.max[0] - pr.min[0])) <= tol && Math.abs(2 * h.radius - (pr.max[1] - pr.min[1])) <= tol) outlineOf.set(h.view, h.at);
  }
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
    const at = ring ? ring.center : h.at, round = outlineOf.get(h.view);
    if (round && Math.abs(round[0] - at[0]) <= SAME && Math.abs(round[1] - at[1]) <= SAME) continue;
    for (const k of [0, 1] as const) {
      if (Math.abs(at[k] - pr.min[k]) <= SAME || Math.abs(at[k] - pr.max[k]) <= SAME) continue;
      if (!holeLocated(ctx, h, ring, at, k, holes)) { unlocated++; where.push(h.view); break; }
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
    case 'remove-detail': { const kept = (s.details ?? []).filter(d => d.id !== fix.detail), rest: DrawingSettings = { ...s, dimensions: s.dimensions.filter(d => d.view !== `detail:${fix.detail}`) }; delete rest.details; return kept.length ? { ...rest, details: kept } : rest; }
    case 'remove-break': { const kept = (s.breaks ?? []).filter((_, k) => k !== fix.index), rest = { ...s }; delete rest.breaks; return kept.length ? { ...rest, breaks: kept } : rest; }
    case 'remove-datum': return { ...s, datums: (s.datums ?? []).filter(d => d.id !== fix.datum) };
    case 'add-section': return sectionsOf(s).some(x => x.id === fix.id) ? s : withSections(s, [...sectionsOf(s), { id: fix.id, view: fix.view, at: fix.at, ...(fix.dir ? { dir: fix.dir } : {}) }]);
    case 'remove-frame': return { ...s, frames: (s.frames ?? []).filter(f => f.id !== fix.frame) };
    case 'move': return { ...s, dimensions: s.dimensions.map(d => d.id === fix.dim ? { ...d, place: fix.place } : d) };
    case 'move-note': return { ...s, notes: (s.notes ?? []).map(n => n.id === fix.note ? { ...n, at: fix.at } : n) };
    case 'move-table': return { ...s, tables: (s.tables ?? []).map(x => (x.id === fix.table ? { ...x, at: fix.at, corner: 'top-left' as const } : x)) };
    case 'accept': return { ...s, dimensions: s.dimensions.map(d => d.id === fix.dim ? accepted(d) : d) };
    case 'scale': { const { scale: _drop, ...rest } = s; void _drop; return { ...rest, ...(fix.scale !== undefined && SCALES.includes(fix.scale) ? { scale: fix.scale } : {}), ...(fix.sheet ? { sheet: fix.sheet } : {}) }; }
    // (O172: with the part's elements, as Auto-dimension has them — the keyseats' plans, and the bought ones left out.)
    case 'auto-dimension': return { ...s, dimensions: autoDimensions(ctx.views, ctx.layout, s, ctx.callout, ctx.elements ?? [], ctx.sections, ctx.locationOwner).dimensions };
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
export interface SheetInputs { views: DrawingViews; settings: DrawingSettings; /** O7: the document's fastener sizes. */ fastenerSizes?: FastenerSizes; /** The part's machine elements (O145): Auto layout's leader notes for keys and pins. */ elements?: readonly PartElement[]; callout: (edge: string, diameter?: number) => string | null; locationOwner?: (edge: string) => string | null; fitMiss?: (edge: string, diameter: number) => string | null; followedChanged?: readonly string[]; meta: Omit<Parameters<typeof buildSheet>[3], 'callout'>; /** O148 X1: the sections cut (each with its projection; those the settings list are drawn). */ sections?: readonly SheetSection[] }

/** The context of a sheet built from its inputs (its layout from the settings, the sections' extents with it). */
export function issueContext(i: SheetInputs): IssueContext {
  const layout = layoutSheet(i.views, i.settings, sectionExtents(i.settings, i.sections));
  const sheet = buildSheet(i.views, layout, i.settings, { ...i.meta, callout: i.callout }, i.sections);
  return { views: i.views, layout, settings: i.settings, sheet, callout: i.callout, ...(i.locationOwner ? { locationOwner: i.locationOwner } : {}), ...(i.sections ? { sections: i.sections } : {}), ...(i.elements ? { elements: i.elements } : {}), ...(i.fitMiss ? { fitMiss: i.fitMiss } : {}), ...(i.followedChanged?.length ? { followedChanged: i.followedChanged } : {}), ...(i.fastenerSizes ? { fastenerSizes: i.fastenerSizes } : {}), rebuild: settings => issueContext({ ...i, settings }) };
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

/** How many times one Fix builds the sheet again and fixes what that shows (O170). */
export const FIX_ROUNDS = 4;
/** A sheet's issues as [errors, warnings], to tell a better one (O174). */
export const fixScore = (issues: readonly DrawingIssue[]): [number, number] => [issues.filter(x => x.severity === 'error').length, issues.filter(x => x.severity !== 'error').length];
const betterScore = (a: readonly [number, number], b: readonly [number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
/** One Fix's rounds so far (O170, O174, O175): the chat runs them in one call; the studio one per sheet, once the
 *  sections the round before added are cut. */
export type FixRounds = { round: number; sectioned: boolean; applied: DrawingFix[]; best: { score: [number, number]; settings: DrawingSettings; applied: number; left: DrawingIssue[] } };
export type FixRoundStep = { state: FixRounds; next?: DrawingSettings; settings: DrawingSettings; applied: DrawingFix[]; left: DrawingIssue[] };
export function fixRoundsStart(i: SheetInputs): FixRounds {
  const left = drawingIssues(issueContext(i));
  return { round: 0, sectioned: true, applied: [], best: { score: fixScore(left), settings: i.settings, applied: 0, left } };
}
/** What the rounds so far leave: the best sheet they reached — fewer errors, then fewer warnings — kept only when better
 *  than the one the Fix started from (O174), with the fixes that led to it and its issues. */
export const fixRoundsOutcome = (state: FixRounds): FixRoundStep => ({ state, settings: state.best.settings, applied: state.applied.slice(0, state.best.applied), left: state.best.left });
/** The next round of a Fix, on the sheet built from the last round's settings (`i`). `next`: the settings to build the
 *  sheet from and come back with; with none, the rounds are over and the step is their outcome. A round dimensions again
 *  only when the round before added a section, its new view (O172). `only` narrows the fixes, as fixAll's. */
export function fixRound(state: FixRounds, i: SheetInputs, only: (fix: DrawingFix, issue: DrawingIssue) => boolean = () => true): FixRoundStep {
  let best = state.best;
  if (state.round > 0) {
    const left = drawingIssues(issueContext(i)), score = fixScore(left);
    if (betterScore(score, best.score)) best = { score, settings: i.settings, applied: state.applied.length, left };
  }
  if (state.round >= FIX_ROUNDS) return fixRoundsOutcome({ ...state, best });
  const again = state.sectioned, r = fixAll(i, 40, (fix, issue) => (again || fix.kind !== 'auto-dimension') && only(fix, issue));
  if (!r.applied.length) return fixRoundsOutcome({ ...state, best });
  const next: FixRounds = { round: state.round + 1, sectioned: r.applied.some(f => f.kind === 'add-section'), applied: [...state.applied, ...r.applied], best };
  return { ...fixRoundsOutcome(next), next: r.settings };
}
