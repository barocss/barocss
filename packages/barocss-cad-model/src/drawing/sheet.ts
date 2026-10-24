// The sheet as a display list in sheet millimetres (y down): frame, title block, the projected views
// and the dimensions. The SVG and PDF writers and the workspace all draw from it.
import { weldSymbols, type WeldPlaced } from './welds';
import { balloonMarks, type BalloonPlaced, type BodyFaces } from './balloons';
import type { Bom } from '../bom/core';
import type { WeldJoint } from '../frames/welds';
import type { BrepProjection, ProjectedCurve } from '@barocss/cad';
import { fmtMM, resolveDimension, resolveLine, type Resolved } from './dimensions';
import { centreMarks } from './centres';
import { threadMarks } from './threads';
import type { FaceThread } from '../app/threads';
import { fitText, textCorners, textWidth } from './text';
import { VIEWS, scaleLabel, sectionDepth, sectionFrame, toSheet, type Orientation, type SectionExtent, type SectionPlacement, type SheetLayout, type ViewPlacement, TITLE_BLOCK } from './views';
import type { DrawingDatum, DrawingFrame, DrawingNote, DrawingSection, DrawingSettings, DrawingTable, DrawingViews, SectionViewId, Tolerance, ViewId, XY } from './types';
import { tableLayout, tableSize, type TableContent, type TableLayout } from './table';
import { VIEW_IDS, detailLetter, isDetailRef, isSectionRef, isViewId, sameSection, sectionLetter, sectionsOf, type DetailRef, type DimView, type SectionRef } from './types';
import { clipProjectionToDisk, clipRingsToDisk, detailScale, type DetailParent, type DrawingDetail } from './detail';
import { clipProjectionOutside, clipRingsOutside } from './breaks';

/** visible 0.5, hidden 0.35 dashed, thin 0.25 (dimensions, title block rules), centre 0.25 chain, frame 0.7. */
export type Pen = 'visible' | 'hidden' | 'thin' | 'center' | 'frame';
export const PENS: Record<Pen, { width: number; dash?: number[] }> = {
  visible: { width: 0.5 }, hidden: { width: 0.35, dash: [3, 1.5] }, thin: { width: 0.25 }, center: { width: 0.25, dash: [8, 1.5, 1.5, 1.5] }, frame: { width: 0.7 },
};
/** G24 (the drawing's annotations on the model): what a line of an annotation is, for the 3D display's styles. */
export type LineRole = 'dimension' | 'extension' | 'leader' | 'frame' | 'weld';
/** G24: an arrowhead (or a dot, a datum's triangle) as a head, sheet mm: its tip, its direction (unit), length and width. */
export interface Head { style: 'filled' | 'open' | 'dot' | 'tick'; tip: XY; dir: XY; length: number; width: number }
export type Mark =
  | { kind: 'line'; a: XY; b: XY; pen: Pen; role?: LineRole }
  /** `center + u·cos t + v·sin t`, t from t0 to t1 (sheet mm). */
  | { kind: 'arc'; center: XY; u: XY; v: XY; t0: number; t1: number; pen: Pen; role?: LineRole }
  | { kind: 'polyline'; points: XY[]; pen: Pen; role?: LineRole }
  | { kind: 'fill'; points: XY[]; head?: Head }
  /** Parallel lines `spacing` apart at `angle` degrees (counter-clockwise as read) over rings, even–odd (R11b, O1: kept as one mark so a DXF gets a HATCH; SVG and PDF draw its lines). */
  /** `angle`: the lines' direction on the sheet (degrees, y down the paper): 45 for one body, a body's own in a section of several. */
  | { kind: 'hatch'; rings: XY[][]; spacing: number; angle: number; pen: Pen }
  /** `angle`: degrees, counter-clockwise as read on the sheet. */
  | { kind: 'text'; at: XY; text: string; size: number; anchor: 'start' | 'middle' | 'end'; angle?: number; bold?: boolean };
/** `datum`, `control` (R14.4, O5): a datum feature symbol, a feature control frame. */
/** `table` (O49): a drawing table, its id the table's. */
/** `weld` (FRd2, O119): a weld symbol, its id the joint's W-number. */
/** `balloon` (O147 B2): an item balloon, its id the BOM line's number. */
/** O148 X1: a section as the sheet draws it — its letter, view and place along the view's depth, its projection and cut rings (`ringBodies`: each ring's body, the part's output index). */
export interface SheetSection extends DrawingSection { projection: BrepProjection; rings: XY[][]; ringBodies?: number[] }
/** A body's hatch in a section of several (the viewport's order, the GPU lane's G19.3): 45°, 135°, 30°, 120°, 60°, 150°; past them, wider. */
export const HATCH_ANGLES: readonly number[] = [45, 135, 30, 120, 60, 150];
export const HATCH_SPACING = 2.5;
/** A section's rings by body, each body's angle and spacing (no bodies given: one group at 45°). */
export function hatchGroups(rings: readonly XY[][], bodies?: readonly number[]): { body: number; rings: XY[][]; angle: number; spacing: number }[] {
  const by = new Map<number, XY[][]>();
  rings.forEach((r, k) => { const b = bodies?.[k] ?? 0; (by.get(b) ?? by.set(b, []).get(b)!).push(r); });
  return [...by].sort((a, b) => a[0] - b[0]).map(([body, rs]) => ({ body, rings: rs, angle: HATCH_ANGLES[body % HATCH_ANGLES.length], spacing: HATCH_SPACING * (1 + 0.4 * Math.floor(body / HATCH_ANGLES.length)) }));
}
/** The sections that cut (O148 X1), as the sheet draws them; one that failed is left out (its error is the caller's to say). */
export const sheetSections = (cuts: readonly (DrawingSection & { result: { ok: true; projection: BrepProjection; rings: XY[][]; ringBodies?: number[] } | { ok: false; error: string } })[]): SheetSection[] =>
  cuts.flatMap(c => c.result.ok ? [{ id: c.id, view: c.view, at: c.at, ...(c.dir ? { dir: c.dir } : {}), ...(c.half ? { half: c.half } : {}), ...(c.steps ? { steps: c.steps, ...(c.along ? { along: c.along } : {}) } : {}), ...(c.removed ? { removed: c.removed } : {}), ...(c.revolved ? { revolved: true as const } : {}), projection: c.result.projection, rings: c.result.rings, ...(c.result.ringBodies ? { ringBodies: c.result.ringBodies } : {}) }] : []);
/** The middle of the part along a section view's depth (O148 X1: where a new section is cut), from a view that sees that depth edge-on; null if none is shown. */
export function sectionMiddle(views: DrawingViews, view: SectionViewId, orientation?: Orientation): number | null {
  const { k, sign } = sectionDepth(view, orientation);
  for (const id of CUT_SHOWN[view]) {
    const pr = views[id], across = Math.abs(pr.up[k]) > 0.5, along = Math.abs(pr.right[k]) > 0.5;
    if (!across && !along) continue;
    const mid = across ? (pr.min[1] + pr.max[1]) / 2 * pr.up[k] : (pr.min[0] + pr.max[0]) / 2 * pr.right[k];
    return Math.round(sign * mid * 100) / 100 + 0;
  }
  return null;
}
/** O148 X2: where a view or a section is on the sheet (a section as the sheet placed it), or undefined. DR-1: a detail as the sheet placed it. */
export function placementOf(layout: SheetLayout, sheet: Pick<Sheet, 'sections' | 'details'> | undefined, v: DimView): ViewPlacement | undefined {
  if (isDetailRef(v)) return sheet?.details?.find(x => x.id === detailLetter(v))?.placement;
  if (!isSectionRef(v)) return layout.views[v];
  const id = sectionLetter(v);
  return sheet?.sections?.find(x => x.id === id)?.placement ?? layout.sections?.find(x => x.section === id);
}
/** O148 X2: a view's or a section's projection (a section's as the sheet drew it), or undefined. */
export function projectionOf(views: DrawingViews, sheet: Pick<Sheet, 'sections' | 'details'> | undefined, v: DimView): BrepProjection | undefined {
  if (isDetailRef(v)) return sheet?.details?.find(x => x.id === detailLetter(v))?.projection;
  if (!isSectionRef(v)) return views[v];
  const id = sectionLetter(v);
  return sheet?.sections?.find(x => x.id === id)?.projection;
}
/** O148 X1: the extents of the sections the settings list and the caller cut (for the layout). */
export function sectionExtents(settings: DrawingSettings, sections?: readonly SheetSection[]): SectionExtent[] {
  const out: SectionExtent[] = [];
  // (DR-4: a removed or revolved section takes no room in the rows: it is drawn apart, or on its view.)
  for (const x of sectionsOf(settings)) { if (x.removed || x.revolved) continue; const c = sections?.find(y => sameSection(y, x)); if (c) out.push({ id: x.id, view: x.view, min: c.projection.min, max: c.projection.max, ...(x.dir ? { aligned: true as const } : {}) }); }
  return out;
}
/** `detail` (DR-1): a detail's circle and letter on its parent (`view` the parent), or the detail itself (`view` its own `detail:B`). */
export interface MarkGroup { role: 'frame' | 'title' | 'view' | 'label' | 'dimension' | 'section' | 'note' | 'datum' | 'control' | 'table' | 'weld' | 'balloon' | 'detail'; id?: string; view?: DimView; marks: Mark[] }
export interface SheetSectionPlaced { id: string; view: SectionViewId; placement: SectionPlacement; projection: BrepProjection; form?: 'removed' | 'revolved'; on?: ViewId }
/** DR-1: a detail as the sheet drew it: its parent, scale, placement (its circle's square) and clipped projection; where its dimensions are drawn. */
export interface SheetDetail { id: string; view: DetailParent; scale: number; placement: ViewPlacement; projection: BrepProjection }
/** `tables`: each table placed (its box), or why its source gave nothing (drawn with the reason). */
export interface Sheet { size: [number, number]; groups: MarkGroup[]; dimensions: Resolved[]; tables?: { id: string; box: [number, number, number, number]; error?: string; /** FRa (O115): a table in blocks, this one's place: [k, of n]. */ part?: [number, number] }[]; /** FRd2 (O119): the weld symbols placed (each joint's view, arrow tip, seam edge) and the joints seen in no view. */ welds?: { placed: readonly WeldPlaced[]; unshown: readonly string[] }; /** O147 B2: the item balloons placed, the item numbers with no clear room, and those with no visible edge. */ balloons?: { placed: readonly BalloonPlaced[]; unclear: readonly number[]; noEdge: readonly number[] }; /** O148 X2: each section as placed (moved under its view's name) with its projection: where its dimensions are drawn. DR-4: `form` a removed or revolved one's, `on` the view a revolved one is drawn on. */ sections?: SheetSectionPlaced[]; /** DR-4: the removed sections with no free room, the revolved ones with no view to be drawn on. */ sectionsMissing?: { id: string; why: 'room' | 'view' }[]; /** DR-1: each detail drawn; `unplaced`: the details whose parent is not on the sheet, and those with no room. */ details?: SheetDetail[]; detailsMissing?: { id: string; why: 'parent' | 'room' | 'empty' }[] }

export const TEXT = 3.5;
const ARROW = 3, ARROW_HALF = 0.6, GAP = 1, OVER = 2;

/** `sections` (O148 X1): each section's projection and cut-face rings (view coordinates), drawn where the layout places it. */
/** `meta.callout`: a diameter dimension's text from the feature it measures (a hole callout), or null for Ø. */
/** `meta.tableContent`: a table's content from its source (O49; absent: a sourced table says it was not filled). */
export function buildSheet(views: DrawingViews, layout: SheetLayout, settings: DrawingSettings, meta: { title: string; date: string; /** O9: the source revision drawn in the title block. */ source?: string; callout?: (edge: string, diameterMM?: number) => string | null; threads?: ReadonlyMap<string, FaceThread>; tableContent?: (t: DrawingTable) => TableContent | { error: string }; /** FRd2 (O119): the frame's weld joints, for its symbols. */ welds?: readonly WeldJoint[]; /** O147 B2: the BOM (worked out by the caller), for the item balloons. */ bom?: Bom; /** The base part's face names by body key (O177): a balloon of a `base:<body>` line finds its body's edges. */ bodyFaces?: BodyFaces }, sections?: readonly SheetSection[]): Sheet {
  const groups: MarkGroup[] = [];
  const [W, H] = layout.size, f = layout.frame;
  groups.push({ role: 'frame', marks: [rect([0, 0, W, H], 'thin'), rect(f, 'frame')].flat() });
  groups.push({ role: 'title', marks: titleBlock(layout, settings, meta) });
  for (const id of VIEW_IDS) {
    const v = layout.views[id], marks: Mark[] = [];
    if (v.hidden) continue;
    // (DR-2: a broken view's curves outside its bands; `toSheet` closes the gaps.)
    const pr = v.breaks ? clipProjectionOutside(views[id], v.breaks) : views[id];
    const showHidden = settings.hidden && id !== 'iso';
    // Hidden pieces first, so visible ink covers them where they touch.
    for (const visible of [false, true]) for (const e of pr.edges) for (const p of e.pieces) {
      if (p.visible !== visible || (!visible && !showHidden)) continue;
      marks.push(curveMark(v, p.curve, !visible ? 'hidden' : e.tangent ? 'thin' : 'visible'));
    }
    if (id !== 'iso' && settings.centers !== false) marks.push(...centreMarks(v, pr));
    if (id !== 'iso' && meta.threads) marks.push(...threadMarks(v, pr, meta.threads, showHidden));
    if (v.breaks) marks.push(...breakLines(v));
    groups.push({ role: 'view', view: id, marks });
  }
  // (A dimension in a view not shown (R14.3) is kept, unresolved, so the issue list names it. O148 X2: one on a section is
  // resolved once the sections are placed, below.)
  const inViews: Resolved[] = settings.dimensions.filter(d => isViewId(d.view)).map((d): Resolved => layout.views[d.view as ViewId].hidden ? { ok: false, dim: d, reason: `Its view (${d.view}) is not shown.` } : resolveDimension(views, d)).map((r): Resolved => r.ok ? { ...r, text: dimensionText(r, meta.callout) } : r);
  for (const r of inViews) if (r.ok) {
    const marks = dimensionMarks(layout.views[r.dim.view as ViewId], r);
    if (r.dim.basic) marks.push(...basicBox(marks));
    groups.push({ role: 'dimension', id: r.dim.id, view: r.dim.view, marks });
  }
  // Datum features and feature control frames (R14.4, O5): a frame under its dimension's text.
  for (const d of settings.datums ?? []) { if (layout.views[d.view].hidden) continue; const marks = datumMarks(layout, views, d); if (marks) groups.push({ role: 'datum', id: d.id, view: d.view, marks }); }
  for (const f of settings.frames ?? []) {
    const g = groups.find(x => x.role === 'dimension' && x.id === f.dim), main = g?.marks.find((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
    if (g && main) groups.push({ role: 'control', id: f.id, view: g.view, marks: frameMarks(main, f) });
  }
  for (const n of settings.notes ?? []) groups.push({ role: 'note', id: n.id, marks: noteMarks(layout, n) });
  // (O148 X1: each section's cutting plane in the view that sees it edge-on, before the views' names: a name goes below its view's cutting-plane ends.)
  // (Pushed after each section's drawing, as A–A's always was: the DXF's entities keep their order.)
  const cutting = new Map<string, MarkGroup>();
  for (const p of layout.sections ?? []) { const sec = sections?.find(x => x.id === p.section); const g = sec && cuttingPlane(layout, views, sec, settings.orientation); if (g) cutting.set(p.section, g); }
  for (const sec of sections ?? []) if (sec.removed && sectionsOf(settings).some(x => sameSection(x, sec))) { const g = cuttingPlane(layout, views, sec, settings.orientation); if (g) cutting.set(sec.id, g); }
  // Each view's name under it, below any dimension placed under the view.
  for (const id of VIEW_IDS) {
    if (layout.views[id].hidden) continue;
    const [x0, , x1, y1] = layout.views[id].box;
    let below = y1;
    for (const g of [...groups, ...cutting.values()]) if ((g.role === 'dimension' || g.role === 'datum' || g.role === 'control' || g.role === 'section') && g.view === id) for (const m of g.marks) for (const p of markPoints(m)) if (p[0] >= x0 - 2 && p[0] <= x1 + 2 && p[1] > below) below = p[1];
    groups.push({ role: 'label', view: id, marks: [{ kind: 'text', at: [(x0 + x1) / 2, below + 7], text: VIEWS[id].label, size: 2.5, anchor: 'middle' }] });
  }
  // (O148 X1: each section placed, its name under it; a front's or a right's under its view's name, as A–A always was.)
  const onSheet: SheetSectionPlaced[] = [], inSections = new Map<string, Resolved>();
  for (const p of layout.sections ?? []) {
    const sec = sections?.find(x => x.id === p.section); if (!sec) continue;
    const parent = p.of !== 'top' ? groups.find(g => g.role === 'label' && g.view === p.of)?.marks[0] as Extract<Mark, { kind: 'text' }> | undefined : undefined;
    const shift = parent ? Math.max(0, parent.at[1] + 6 - p.box[1]) : 0;
    const placed: SectionPlacement = { ...p, origin: [p.origin[0], p.origin[1] + shift], box: [p.box[0], p.box[1] + shift, p.box[2], p.box[3] + shift] };
    groups.push({ role: 'section', id: sec.id, marks: sectionMarks(placed, sec) });
    const c = cutting.get(sec.id); if (c) groups.push(c);
    onSheet.push({ id: sec.id, view: sec.view, placement: placed, projection: sec.projection });
    // (O148 X2: its dimensions, drawn as a view's; its name under them.)
    const ref: SectionRef = `section:${sec.id}`;
    for (const d of settings.dimensions) if (d.view === ref) {
      const r = resolveDimension({ [ref]: sec.projection }, d), shown = r.ok ? { ...r, text: dimensionText(r, meta.callout) } as Resolved : r;
      inSections.set(d.id, shown);
      if (!shown.ok) continue;
      const marks = dimensionMarks(placed, shown); if (d.basic) marks.push(...basicBox(marks));
      groups.push({ role: 'dimension', id: d.id, view: ref, marks });
    }
    const [x0, , x1, y1] = placed.box;
    let below = y1;
    for (const g of groups) if (g.role === 'dimension' && g.view === ref) for (const m of g.marks) for (const q of markPoints(m)) if (q[0] >= x0 - 2 && q[0] <= x1 + 2 && q[1] > below) below = q[1];
    groups.push({ role: 'label', marks: [{ kind: 'text', at: [(x0 + x1) / 2, below + 7], text: `SECTION ${sec.id}–${sec.id}`, size: 2.5, anchor: 'middle' }] });
  }
  // (DR-4: the removed sections in free room and the revolved ones on their views, after the others; their dimensions too.)
  const apart = apartSections(layout, views, settings, groups, onSheet, sections ?? [], cutting, meta.callout);
  groups.push(...apart.groups); onSheet.push(...apart.placed);
  for (const [id, r] of apart.resolved) inSections.set(id, r);
  // (A dimension on a section the sheet does not have, kept unresolved so the issue list names it; its frames, as a view's.)
  for (const d of settings.dimensions) if (isSectionRef(d.view) && !inSections.has(d.id)) inSections.set(d.id, { ok: false, dim: d, reason: `Its section (${sectionLetter(d.view)}–${sectionLetter(d.view)}) is not on the sheet.` });
  // (DR-1: the details, after the sections — a detail may enlarge one — each with its dimensions and name.)
  const drawn = detailGroups(layout, views, settings, groups, onSheet, sections ?? [], meta.callout);
  groups.push(...drawn.groups);
  for (const [id, r] of drawn.resolved) inSections.set(id, r);
  for (const f of settings.frames ?? []) {
    const g = groups.find(x => x.role === 'dimension' && x.id === f.dim && x.view && !isViewId(x.view)), main = g?.marks.find((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
    if (g && main) groups.push({ role: 'control', id: f.id, view: g.view, marks: frameMarks(main, f) });
  }
  const dimensions: Resolved[] = settings.dimensions.map(d => inSections.get(d.id) ?? inViews.find(r => r.dim === d)!);
  // (FRd2, O119: the weld symbols, before the tables so an auto-placed one keeps clear of their texts.)
  const welds = settings.weldSymbols && meta.welds?.length ? weldSymbols(layout, views, meta.welds) : null;
  if (welds) groups.push(...welds.groups);
  // (O147 B2: the item balloons, after the weld symbols and before the tables: clear of the texts so far and of the pinned tables.)
  // (Clear of the tables pinned by `at` too: they are placed after, where they were set.)
  const pinned = (settings.tables ?? []).filter(t => t.at).map(t => tableLayout(tableContentOf(t, meta.tableContent).content, t.at!, t.corner ?? 'top-left').box as Rect);
  const detailBoxes = [...drawn.details.map(x => x.box), ...apart.boxes];
  const balloons = settings.balloons && meta.bom?.lines.length ? balloonMarks(layout, views, meta.bom, [...takenOf(layout, groups, detailBoxes), ...pinned], meta.bodyFaces) : null;
  if (balloons) groups.push(...balloons.groups);
  // (Tables last: an auto-placed one finds room clear of everything else on the sheet, O49.)
  const tables = tableGroups(layout, settings, groups, meta.tableContent, detailBoxes);
  groups.push(...tables.groups);
  return { size: [W, H], groups, dimensions, ...(tables.placed.length ? { tables: tables.placed } : {}), ...(welds ? { welds: { placed: welds.placed, unshown: welds.unshown } } : {}), ...(balloons ? { balloons: { placed: balloons.placed, unclear: balloons.unclear, noEdge: balloons.noEdge } } : {}), ...(onSheet.length ? { sections: onSheet } : {}), ...(drawn.details.length ? { details: drawn.details.map(x => x.detail) } : {}), ...(drawn.missing.length ? { detailsMissing: drawn.missing } : {}), ...(apart.missing.length ? { sectionsMissing: apart.missing } : {}) };
}

/** The view a revolved section is drawn on (DR-4): a front section's on the top view, a top's or a right's on the front view (both always shown). */
export const REVOLVED_ON: Record<SectionViewId, ViewId> = { front: 'top', top: 'front', right: 'front' };
/**
 * Where a revolved section (DR-4) is drawn on its view: the cut face turned a quarter about its trace (the plane seen
 * edge-on) so that it faces the view's viewer as it faced the section's — p' = p + (p·t − c)·d with t the view's
 * `toward`, d the section's depth and c the face's middle along t, so the face is centred on the trace. For the views
 * REVOLVED_ON names this map is a pure shift in the section's own coordinates; the placement is the view's scale with
 * the origin moved by it (through the view's breaks at the face's middle). Null when the view is hidden or the map is not
 * a shift.
 */
export function revolvedPlacement(layout: SheetLayout, views: DrawingViews, sec: Pick<SheetSection, 'id' | 'view' | 'at' | 'projection'>): { placement: SectionPlacement; on: ViewId; along: XY } | null {
  const on = REVOLVED_ON[sec.view], W = layout.views[on], w = views[on], pr = sec.projection;
  if (W.hidden) return null;
  const d = [-pr.toward[0], -pr.toward[1], -pr.toward[2]], n2: XY = [dot3(d, w.right), dot3(d, w.up)];
  const lin = [dot3(pr.right, w.right) + dot3(pr.right, w.toward) * n2[0], dot3(pr.up, w.right) + dot3(pr.up, w.toward) * n2[0], dot3(pr.right, w.up) + dot3(pr.right, w.toward) * n2[1], dot3(pr.up, w.up) + dot3(pr.up, w.toward) * n2[1]];
  if (Math.abs(dot3(d, w.toward)) > 1e-9 || Math.abs(lin[0] - 1) > 1e-9 || Math.abs(lin[1]) > 1e-9 || Math.abs(lin[2]) > 1e-9 || Math.abs(lin[3] - 1) > 1e-9) return null;
  // (The face's middle along the view's toward: from its extent's corners, p·t linear in the section's coordinates.)
  const tr = dot3(pr.right, w.toward), tu = dot3(pr.up, w.toward), lo = Math.min(tr * pr.min[0], tr * pr.max[0]) + Math.min(tu * pr.min[1], tu * pr.max[1]), hi = Math.max(tr * pr.min[0], tr * pr.max[0]) + Math.max(tu * pr.min[1], tu * pr.max[1]);
  const c = (lo + hi) / 2, shift: XY = [(sec.at - c) * n2[0], (sec.at - c) * n2[1]];
  const A: XY = [(pr.min[0] + pr.max[0]) / 2, (pr.min[1] + pr.max[1]) / 2], at = toSheet(W, [A[0] + shift[0], A[1] + shift[1]]), s = W.scale;
  const origin: XY = [at[0] - s * A[0], at[1] + s * A[1]];
  return { on, along: [-n2[1], n2[0]], placement: { id: 'section', section: sec.id, of: sec.view, scale: s, origin, box: [origin[0] + s * pr.min[0], origin[1] - s * pr.max[1], origin[0] + s * pr.max[0], origin[1] - s * pr.min[1]] } };
}
const dot3 = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/**
 * The removed and revolved sections (DR-4). A removed one: its cut face (outline and hatch) at its scale (absent: the
 * sheet's) centred where it was put or in the first free room (as a detail is found room), its dimensions, its name
 * `SECTION B–B` (with its scale when not the sheet's) under them; its cutting line (already in `cutting`) on its view. A
 * revolved one: its cut face on the view REVOLVED_ON names (revolvedPlacement), a centreline along the trace 3 mm past
 * it, no name; its dimensions drawn there.
 */
function apartSections(layout: SheetLayout, views: DrawingViews, settings: DrawingSettings, before: readonly MarkGroup[], placedSections: readonly SheetSectionPlaced[], sections: readonly SheetSection[], cutting: ReadonlyMap<string, MarkGroup>, callout?: (edge: string, diameterMM?: number) => string | null): { groups: MarkGroup[]; placed: SheetSectionPlaced[]; boxes: Rect[]; missing: NonNullable<Sheet['sectionsMissing']>; resolved: Map<string, Resolved> } {
  const groups: MarkGroup[] = [], placed: SheetSectionPlaced[] = [], boxes: Rect[] = [], missing: NonNullable<Sheet['sectionsMissing']> = [], resolved = new Map<string, Resolved>();
  const taken = takenOf(layout, [...before, ...cutting.values()], placedSections.map(x => x.placement.box));
  for (const s of sectionsOf(settings)) {
    if (!s.removed && !s.revolved) continue;
    const sec = sections.find(x => sameSection(x, s)); if (!sec) continue;
    const pr = sec.projection, ref: SectionRef = `section:${s.id}`;
    let placement: SectionPlacement, on: ViewId | undefined, along: XY | null = null, k = layout.scale;
    if (s.removed) {
      // (Its place and scale from the settings: the cut is matched without them, so a moved one is not cut again.)
      k = s.removed.scale ?? layout.scale;
      const w = k * (pr.max[0] - pr.min[0]), h = k * (pr.max[1] - pr.min[1]);
      let at: XY | null = s.removed.at ?? null;
      if (!at) { const room = detailRoom(layout, taken, w, h + DETAIL_LABEL); if (room) at = [room[0] + w / 2, room[1] + h / 2]; }
      if (!at) { missing.push({ id: s.id, why: 'room' }); continue; }
      const cx = (pr.min[0] + pr.max[0]) / 2, cy = (pr.min[1] + pr.max[1]) / 2;
      placement = { id: 'section', section: s.id, of: s.view, scale: k, origin: [at[0] - k * cx, at[1] + k * cy], box: [at[0] - w / 2, at[1] - h / 2, at[0] + w / 2, at[1] + h / 2] };
    } else {
      const r = revolvedPlacement(layout, views, sec);
      if (!r) { missing.push({ id: s.id, why: 'view' }); continue; }
      placement = r.placement; on = r.on; along = r.along;
    }
    const marks: Mark[] = [];
    for (const e of pr.edges) for (const p of e.pieces) if (p.visible) marks.push(curveMark(placement, p.curve, 'visible'));
    for (const g of hatchGroups(sec.rings, sec.ringBodies)) marks.push({ kind: 'hatch', rings: g.rings.map(r => r.map(q => toSheet(placement, q))), spacing: g.spacing, angle: g.angle, pen: 'thin' });
    if (along) {
      // (The axis it was turned about: the trace, through the face's middle, 3 mm past its ends.)
      const A: XY = [(pr.min[0] + pr.max[0]) / 2, (pr.min[1] + pr.max[1]) / 2], reach = Math.max(Math.abs(along[0]) * (pr.max[0] - pr.min[0]), Math.abs(along[1]) * (pr.max[1] - pr.min[1])) / 2 + 3 / placement.scale;
      marks.push({ kind: 'line', a: toSheet(placement, [A[0] - reach * along[0], A[1] - reach * along[1]]), b: toSheet(placement, [A[0] + reach * along[0], A[1] + reach * along[1]]), pen: 'center' });
    }
    groups.push({ role: 'section', id: s.id, ...(on ? { view: on } : {}), marks });
    const cut = cutting.get(s.id); if (cut) groups.push(cut);
    placed.push({ id: s.id, view: s.view, placement, projection: pr, form: s.removed ? 'removed' : 'revolved', ...(on ? { on } : {}) });
    for (const d of settings.dimensions) if (d.view === ref) {
      const r = resolveDimension({ [ref]: pr }, d), shown = r.ok ? { ...r, text: dimensionText(r, callout) } as Resolved : r;
      resolved.set(d.id, shown);
      if (!shown.ok) continue;
      const dm = dimensionMarks(placement, shown); if (d.basic) dm.push(...basicBox(dm));
      groups.push({ role: 'dimension', id: d.id, view: ref, marks: dm });
    }
    if (!s.removed) continue;
    const [x0, , x1, y1] = placement.box;
    let below = y1;
    for (const g of groups) if (g.role === 'dimension' && g.view === ref) for (const m of g.marks) for (const q of markPoints(m)) if (q[0] >= x0 - 2 && q[0] <= x1 + 2 && q[1] > below) below = q[1];
    groups.push({ role: 'label', marks: [{ kind: 'text', at: [(x0 + x1) / 2, below + DETAIL_LABEL], text: `SECTION ${s.id}–${s.id}${Math.abs(k - layout.scale) > 1e-12 ? ` (${scaleLabel(k)})` : ''}`, size: 2.5, anchor: 'middle' }] });
    const box: Rect = [placement.box[0], placement.box[1], placement.box[2], below + DETAIL_LABEL];
    taken.push(box); boxes.push(box);
  }
  return { groups, placed, boxes, missing, resolved };
}

type Rect = [number, number, number, number];
/** Sheet mm a detail's name takes under it (and its dimensions), and the gap kept round an auto-placed detail. */
const DETAIL_LABEL = 7, DETAIL_GAP = 4;
/**
 * The details (DR-1): each on its parent — a shown orthographic view, or a section on the sheet — as a thin circle with
 * its letter; drawn at its scale where it was put (`at`) or in the first free room (from the frame's top right, down then
 * left), as the parent's projection clipped to the circle (hidden lines as the parent shows them; a section's cut faces
 * clipped and hatched as the section's), the circle round it; its dimensions resolved on that projection; its name
 * `DETAIL B (5:1)` under them.
 */
function detailGroups(layout: SheetLayout, views: DrawingViews, settings: DrawingSettings, before: readonly MarkGroup[], placedSections: NonNullable<Sheet['sections']>, sections: readonly SheetSection[], callout?: (edge: string, diameterMM?: number) => string | null): { groups: MarkGroup[]; details: { detail: SheetDetail; box: Rect }[]; missing: NonNullable<Sheet['detailsMissing']>; resolved: Map<string, Resolved> } {
  const groups: MarkGroup[] = [], details: { detail: SheetDetail; box: Rect }[] = [], missing: NonNullable<Sheet['detailsMissing']> = [], resolved = new Map<string, Resolved>();
  const taken = takenOf(layout, before, placedSections.map(x => x.placement.box));
  for (const d of settings.details ?? []) {
    const parent = detailParent(layout, views, placedSections, sections, d);
    if (!parent) { missing.push({ id: d.id, why: 'parent' }); continue; }
    const projection = clipProjectionToDisk(parent.projection, d.center, d.radius);
    const cut = parent.rings.length ? clipRingsToDisk(parent.rings, d.center, d.radius) : { rings: [], kept: [] };
    if (!projection.edges.length && !cut.rings.length) missing.push({ id: d.id, why: 'empty' });
    const k = detailScale(d, layout.scale), half = k * d.radius;
    // (On the parent: the circle and the letter outside it, up and to the right.)
    const pc = toSheet(parent.placement, d.center), pr = d.radius * parent.placement.scale;
    groups.push({ role: 'detail', id: d.id, view: d.view, marks: [circleMark(pc, pr, 'thin'), { kind: 'text', at: [pc[0] + pr * Math.SQRT1_2 + 1, pc[1] - pr * Math.SQRT1_2 - 1], text: d.id, size: TEXT, anchor: 'start', bold: true }] });
    let at: XY | null = d.at ?? null;
    if (!at) { const room = detailRoom(layout, taken, 2 * half, 2 * half + DETAIL_LABEL); if (room) at = [room[0] + half, room[1] + half]; }
    if (!at) { missing.push({ id: d.id, why: 'room' }); continue; }
    const placement: ViewPlacement = { id: 'detail', scale: k, origin: [at[0] - k * d.center[0], at[1] + k * d.center[1]], box: [at[0] - half, at[1] - half, at[0] + half, at[1] + half] };
    const marks: Mark[] = [];
    for (const visible of [false, true]) for (const e of projection.edges) for (const p of e.pieces) {
      if (p.visible !== visible || (!visible && !parent.hidden)) continue;
      marks.push(curveMark(placement, p.curve, !visible ? 'hidden' : e.tangent ? 'thin' : 'visible'));
    }
    const bodies = parent.ringBodies ? cut.kept.map(i => parent.ringBodies![i]) : undefined;
    for (const g of hatchGroups(cut.rings, bodies)) marks.push({ kind: 'hatch', rings: g.rings.map(r => r.map(q => toSheet(placement, q))), spacing: g.spacing, angle: g.angle, pen: 'thin' });
    marks.push(circleMark(at, half, 'thin'));
    const ref: DetailRef = `detail:${d.id}`;
    groups.push({ role: 'detail', id: d.id, view: ref, marks });
    for (const dim of settings.dimensions) if (dim.view === ref) {
      const r = resolveDimension({ [ref]: projection }, dim), shown = r.ok ? { ...r, text: dimensionText(r, callout) } as Resolved : r;
      resolved.set(dim.id, shown);
      if (!shown.ok) continue;
      const dm = dimensionMarks(placement, shown); if (dim.basic) dm.push(...basicBox(dm));
      groups.push({ role: 'dimension', id: dim.id, view: ref, marks: dm });
    }
    let below = placement.box[3];
    for (const g of groups) if (g.role === 'dimension' && g.view === ref) for (const m of g.marks) for (const q of markPoints(m)) if (q[0] >= placement.box[0] - 2 && q[0] <= placement.box[2] + 2 && q[1] > below) below = q[1];
    groups.push({ role: 'label', marks: [{ kind: 'text', at: [at[0], below + DETAIL_LABEL], text: `DETAIL ${d.id} (${scaleLabel(k)})`, size: 2.5, anchor: 'middle' }] });
    const box: Rect = [placement.box[0], placement.box[1], placement.box[2], below + DETAIL_LABEL];
    taken.push(box);
    details.push({ detail: { id: d.id, view: d.view, scale: k, placement, projection }, box });
  }
  for (const dim of settings.dimensions) if (isDetailRef(dim.view) && !resolved.has(dim.id)) resolved.set(dim.id, { ok: false, dim, reason: `Its detail (${detailLetter(dim.view)}) is not on the sheet.` });
  return { groups, details, missing, resolved };
}
/** A detail's parent as the sheet has it: a shown orthographic view, or a section placed (its rings and bodies), or null. */
function detailParent(layout: SheetLayout, views: DrawingViews, placedSections: NonNullable<Sheet['sections']>, sections: readonly SheetSection[], d: DrawingDetail): { placement: ViewPlacement; projection: BrepProjection; rings: XY[][]; ringBodies?: number[]; hidden: boolean } | null {
  if (isSectionRef(d.view)) {
    const id = sectionLetter(d.view), p = placedSections.find(x => x.id === id), sec = sections.find(x => x.id === id);
    return p && sec ? { placement: p.placement, projection: p.projection, rings: sec.rings, ...(sec.ringBodies ? { ringBodies: sec.ringBodies } : {}), hidden: false } : null;
  }
  const v = layout.views[d.view];
  return v.hidden ? null : { placement: v, projection: views[d.view], rings: [], hidden: true };
}
/** The first top-left corner for a w × h box clear of `taken` (with a gap), from the frame's top right, down then left in 5 mm steps; null when none is. */
function detailRoom(layout: SheetLayout, taken: readonly Rect[], w: number, h: number): XY | null {
  const [fx0, fy0, fx1, fy1] = layout.frame, g = DETAIL_GAP;
  for (let x1 = fx1 - g; x1 - w >= fx0 + g; x1 -= 5) for (let y0 = fy0 + g; y0 + h <= fy1 - g; y0 += 5) {
    const box: Rect = [x1 - w, y0, x1, y0 + h];
    if (!taken.some(r => meets(box, r, g)) && !meets(box, layout.title, g)) return [box[0], box[1]];
  }
  return null;
}
/**
 * A view's break lines (DR-2): at each side of each gap, a thin line across the view (2 mm past its box) with a small
 * zig-zag at its middle, the long-break symbol.
 */
function breakLines(v: ViewPlacement): Mark[] {
  const out: Mark[] = [], [x0, y0, x1, y1] = v.box;
  for (const b of v.breaks ?? []) for (const w of [b.from, b.to]) {
    // (A side's place: the band's start or end through the breaks — the gap between them on the paper.)
    const at = toSheet(v, b.axis === 0 ? [w, 0] : [0, w]);
    if (b.axis === 0) { const X = at[0], m = (y0 + y1) / 2; out.push({ kind: 'polyline', points: [[X, y0 - 2], [X, m - 1.5], [X - 1.2, m - 0.5], [X + 1.2, m + 0.5], [X, m + 1.5], [X, y1 + 2]], pen: 'thin' }); }
    else { const Y = at[1], m = (x0 + x1) / 2; out.push({ kind: 'polyline', points: [[x0 - 2, Y], [m - 1.5, Y], [m - 0.5, Y - 1.2], [m + 0.5, Y + 1.2], [m + 1.5, Y], [x1 + 2, Y]], pen: 'thin' }); }
  }
  return out;
}
const circleMark = (c: XY, r: number, pen: Pen): Mark => ({ kind: 'arc', center: c, u: [r, 0], v: [0, r], t0: 0, t1: 2 * Math.PI, pen });
const meets = (a: Rect, b: Rect, gap = 1) => a[0] < b[2] + gap && b[0] < a[2] + gap && a[1] < b[3] + gap && b[1] < a[3] + gap;
/** What an auto-placed table must keep clear of: the views' and the section's areas, every text on the sheet so far (and each balloon's circle), the title block. */
function takenOf(layout: SheetLayout, groups: readonly MarkGroup[], extra: readonly Rect[] = []): Rect[] {
  const out: Rect[] = [layout.title, ...extra];
  for (const id of VIEW_IDS) if (!layout.views[id].hidden) out.push(layout.views[id].box);
  for (const x of layout.sections ?? []) out.push(x.box);
  for (const g of groups) if (g.role === 'balloon') for (const m of g.marks) if (m.kind === 'arc') out.push([m.center[0] - m.u[0], m.center[1] - m.v[1], m.center[0] + m.u[0], m.center[1] + m.v[1]]);
  for (const g of groups) if (g.role !== 'frame' && g.role !== 'title' && g.role !== 'view') for (const m of g.marks) if (m.kind === 'text') { const q = textCorners(m.at, m.text, m.size, m.anchor, m.angle ?? 0, !!m.bold); out.push([Math.min(...q.map(p => p[0])), Math.min(...q.map(p => p[1])), Math.max(...q.map(p => p[0])), Math.max(...q.map(p => p[1]))]); }
  return out;
}
/**
 * Each table laid out (O49): at its anchor, or — without one — the first place clear of the views, the texts and the
 * tables already placed, searched from just above the title block at its right edge, upward then leftward in 5 mm steps
 * inside the frame; none clear, it stays at the first place (the issue list then says what it meets).
 */
function tableGroups(layout: SheetLayout, settings: DrawingSettings, before: readonly MarkGroup[], contentOf?: (t: DrawingTable) => TableContent | { error: string }, extra: readonly Rect[] = []): { groups: MarkGroup[]; placed: NonNullable<Sheet['tables']> } {
  const groups: MarkGroup[] = [], placed: NonNullable<Sheet['tables']> = [], taken = takenOf(layout, before, extra);
  for (const t of settings.tables ?? []) if (t.at) { const c = tableContentOf(t, contentOf); taken.push(tableLayout(c.content, t.at, t.corner ?? 'top-left').box); }
  for (const t of settings.tables ?? []) {
    const { content, error } = tableContentOf(t, contentOf);
    let l = t.at ? tableLayout(content, t.at, t.corner ?? 'top-left') : tableLayout(content, [layout.title[2], layout.title[1] - 3], 'bottom-right');
    if (!t.at) {
      const at = roomIn(layout, taken, l.box[2] - l.box[0], l.box[3] - l.box[1]);
      // (FRa, O115: no room for the whole table — the A4 cut list at 1:20, D128 — then its rows in blocks, each placed clear.)
      const blocks = at || t.whole ? null : inBlocks(layout, taken, content);
      if (blocks) {
        for (const [k, b] of blocks.entries()) { taken.push(b.box); groups.push({ role: 'table', id: t.id, marks: b.marks }); placed.push({ id: t.id, box: b.box, part: [k + 1, blocks.length], ...(error ? { error } : {}) }); }
        continue;
      }
      if (at) l = tableLayout(content, at, 'top-left'); taken.push(l.box);
    }
    groups.push({ role: 'table', id: t.id, marks: l.marks });
    placed.push({ id: t.id, box: l.box, ...(error ? { error } : {}) });
  }
  return { groups, placed };
}
/** A table is not split into more blocks than this: one that needs more does not fit, and the issue list says so. */
export const TABLE_BLOCKS_MAX = 6;
/**
 * A table in blocks (FRa, O115), the fewest that all fit: its columns in 1–3 groups of whole columns in order, each after
 * the first column again (the key: ITEM), times its rows in 1, 2 … blocks of whole rows in order (sizes differing by at
 * most one); each block with its header, the title on the first, the notes on the last; each placed clear in turn (as a
 * whole table is). Null when none do.
 */
function inBlocks(layout: SheetLayout, taken: readonly Rect[], content: TableContent): TableLayout[] | null {
  const n = content.rows.length, rest = content.columns.length - 1, tries: [number, number][] = [];
  for (let m = 1; m <= Math.min(3, Math.max(1, rest)); m++) for (let k = 1; k <= Math.min(n, TABLE_BLOCKS_MAX); k++) if (m * k > 1 && m * k <= TABLE_BLOCKS_MAX) tries.push([m, k]);
  tries.sort((a, b) => a[0] * a[1] - b[0] * b[1] || a[0] - b[0]);
  for (const [m, k] of tries) {
    const groups = columnGroups(content, m), room = [...taken], out: TableLayout[] = [], total = m * k;
    for (const cols of groups) for (let i = 0, start = 0; i < k; i++) {
      const size = Math.floor(n / k) + (i < n % k ? 1 : 0), first = out.length === 0, last = out.length === total - 1;
      const part: TableContent = { columns: cols.map(c => content.columns[c]), rows: content.rows.slice(start, start + size).map(r => cols.map(c => r[c])), ...(first && content.title ? { title: content.title } : {}), ...(last && content.notes ? { notes: content.notes } : {}) };
      start += size;
      const probe = tableLayout(part, [0, 0], 'top-left'), at = roomIn(layout, room, probe.box[2] - probe.box[0], probe.box[3] - probe.box[1]);
      if (!at) break;
      const placedBlock = tableLayout(part, at, 'top-left'); room.push(placedBlock.box); out.push(placedBlock);
    }
    if (out.length === total) return out;
  }
  return null;
}
/** The columns' indices in m groups, the first column leading each: the rest split where the widths balance. */
function columnGroups(content: TableContent, m: number): number[][] {
  if (m === 1) return [content.columns.map((_, i) => i)];
  const widths = tableSize(content).widths, rest = widths.slice(1), sum = rest.reduce((a, b) => a + b, 0), out: number[][] = [];
  let at = 1;
  for (let g = 0; g < m; g++) {
    const cols = [0], target = sum * (g + 1) / m;
    let acc = rest.slice(0, at - 1).reduce((a, b) => a + b, 0);
    while (at < widths.length && (g === m - 1 || acc + widths[at] / 2 <= target || cols.length === 1)) { cols.push(at); acc += widths[at]; at++; }
    out.push(cols);
  }
  return out.filter(c => c.length > 1);
}
/** The first top-left corner for a w × h box clear of `taken`: from just above the title block's right end, upward then leftward in 5 mm steps, inside the frame; null when none is. */
function roomIn(layout: SheetLayout, taken: readonly Rect[], w: number, h: number): XY | null {
  const [fx0, fy0, fx1] = layout.frame, right = layout.title[2], bottom = layout.title[1] - 3;
  for (let dx = 0; right - dx - w >= fx0; dx += 5) for (let dy = 0; bottom - dy - h >= fy0; dy += 5) {
    const box: Rect = [right - dx - w, bottom - dy - h, right - dx, bottom - dy];
    if (box[2] <= fx1 && !taken.some(r => meets(box, r))) return [box[0], box[1]];
  }
  return null;
}
/** Room for a table of `box`'s size on a built sheet, clear of everything but itself (O49: the issue list's fix for a table). */
export function tableRoom(layout: SheetLayout, sheet: Sheet, id: string): XY | null {
  const self = sheet.tables?.find(x => x.id === id); if (!self) return null;
  const taken = [...takenOf(layout, sheet.groups.filter(g => !(g.role === 'table' && g.id === id)), (sheet.details ?? []).map(x => x.placement.box)), ...(sheet.tables ?? []).filter(x => x.id !== id).map(x => x.box)];
  return roomIn(layout, taken, self.box[2] - self.box[0], self.box[3] - self.box[1]);
}
/** A table's content, or — its source giving nothing — its title and the reason (never an empty table that reads as "no rows"). */
function tableContentOf(t: DrawingTable, contentOf?: (t: DrawingTable) => TableContent | { error: string }): { content: TableContent; error?: string } {
  const c = t.from ? contentOf?.(t) ?? { error: 'its source was not run for this sheet' } : { ...(t.title ? { title: t.title } : {}), columns: t.columns ?? [], rows: t.rows ?? [] };
  return 'error' in c ? { content: { title: t.title ?? (t.from ?? t.id).toUpperCase(), columns: [{ key: 'why', label: 'NOT AVAILABLE' }], rows: [[c.error]] }, error: c.error } : { content: c };
}

/**
 * What a dimension reads: a diameter on a hole its callout, and `count` before it (`4× Ø6.6 THRU`, `3× 20`) in
 * place of a callout's own count (R14.1, O2).
 */
export function dimensionText(r: Extract<Resolved, { ok: true }>, callout?: (edge: string, diameterMM?: number) => string | null): string {
  // (D155: the diameter measured goes with it — a face's fit class reads its limits at that size, drawing/fits.ts.)
  const base = (r.kind === 'diameter' && callout ? callout(r.dim.edge, 2 * r.radius) : null) ?? r.text;
  return r.dim.count ? `${r.dim.count}× ${base.replace(/^\d+× /, '')}` : base;
}

export function curveMark(v: ViewPlacement, c: ProjectedCurve, pen: Pen): Mark {
  if (c.kind === 'line') return { kind: 'line', a: toSheet(v, c.a), b: toSheet(v, c.b), pen };
  if (c.kind === 'polyline') return { kind: 'polyline', points: c.points.map(p => toSheet(v, p)), pen };
  return { kind: 'arc', center: toSheet(v, c.center), u: [v.scale * c.u[0], -v.scale * c.u[1]], v: [v.scale * c.v[0], -v.scale * c.v[1]], t0: c.t0, t1: c.t1, pen };
}

/** Points a mark reaches (a text's baseline point; an arc sampled). */
function markPoints(m: Mark): XY[] {
  switch (m.kind) {
    case 'line': return [m.a, m.b];
    case 'polyline': case 'fill': return m.points;
    case 'hatch': return m.rings.flat();
    case 'text': return [m.at];
    case 'arc': return Array.from({ length: 9 }, (_, k) => { const t = m.t0 + (m.t1 - m.t0) * k / 8; return [m.center[0] + m.u[0] * Math.cos(t) + m.v[0] * Math.sin(t), m.center[1] + m.u[1] * Math.cos(t) + m.v[1] * Math.sin(t)] as XY; });
  }
}

const rect = ([x0, y0, x1, y1]: readonly number[], pen: Pen): Mark[] => [
  { kind: 'line', a: [x0, y0], b: [x1, y0], pen }, { kind: 'line', a: [x1, y0], b: [x1, y1], pen },
  { kind: 'line', a: [x1, y1], b: [x0, y1], pen }, { kind: 'line', a: [x0, y1], b: [x0, y0], pen },
];

/** The title's room: from 2 mm in to 2 mm short of the projection symbol (its left edge at 59 mm from the right). */
export const TITLE_ROOM = TITLE_BLOCK.width - 2 - 59 - 2;

function titleBlock(layout: SheetLayout, settings: DrawingSettings, meta: { title: string; date: string; source?: string }): Mark[] {
  const [x0, y0, x1, y1] = layout.title, marks: Mark[] = rect(layout.title, 'frame');
  const mid = y0 + 14, cols = [x0, x0 + 24, x0 + 42, x0 + 72, x0 + 90, x1];
  marks.push({ kind: 'line', a: [x0, mid], b: [x1, mid], pen: 'thin' });
  for (const x of cols.slice(1, -1)) marks.push({ kind: 'line', a: [x, mid], b: [x, y1], pen: 'thin' });
  marks.push({ kind: 'text', at: [x0 + 2, y0 + 4], text: 'TITLE', size: 1.8, anchor: 'start' });
  // Each field fits its cell: shrunk to a floor, then cut with an ellipsis. The title runs up to the projection symbol.
  marks.push({ kind: 'text', at: [x0 + 2, y0 + 11], ...fitText(meta.title, 5, true, TITLE_ROOM, 3), anchor: 'start', bold: true });
  marks.push({ kind: 'text', at: [x1 - 2, y0 + 4], text: 'barocss cad-studio', size: 1.8, anchor: 'end' });
  // (O9: the source revision the sheet was drawn from, when given — beside the drawing's own REV, which a person sets.)
  if (meta.source) marks.push({ kind: 'text', at: [x1 - 2, y0 + 8], text: `SRC ${meta.source}`, size: 1.8, anchor: 'end' });
  const cells: [string, string][] = [['SCALE', scaleLabel(layout.scale)], ['UNITS', 'mm'], ['DATE', meta.date], ['REV', settings.revision ?? '-'], ['SHEET', settings.sheet]];
  cells.forEach(([k, val], i) => {
    marks.push({ kind: 'text', at: [cols[i] + 2, mid + 4], text: k, size: 1.8, anchor: 'start' });
    marks.push({ kind: 'text', at: [cols[i] + 2, mid + 12], ...fitText(val, 3.5, true, cols[i + 1] - cols[i] - 4, 2.2), anchor: 'start', bold: true });
  });
  marks.push(...projectionSymbol([x1 - 52, y0 + 7], settings.projection));
  marks.push({ kind: 'text', at: [x1 - 42, y0 + 11.5], text: settings.projection === 'third' ? 'THIRD ANGLE' : 'FIRST ANGLE', size: 1.8, anchor: 'start' });
  return marks;
}

/** The projection symbol: a truncated cone's side view and end view (side view left for third angle). */
function projectionSymbol([cx, cy]: XY, projection: DrawingSettings['projection']): Mark[] {
  const cone = (x: number): Mark[] => [
    { kind: 'line', a: [x - 3, cy - 1.5], b: [x + 3, cy - 3], pen: 'thin' }, { kind: 'line', a: [x + 3, cy - 3], b: [x + 3, cy + 3], pen: 'thin' },
    { kind: 'line', a: [x + 3, cy + 3], b: [x - 3, cy + 1.5], pen: 'thin' }, { kind: 'line', a: [x - 3, cy + 1.5], b: [x - 3, cy - 1.5], pen: 'thin' },
  ];
  const end = (x: number): Mark[] => [
    { kind: 'arc', center: [x, cy], u: [3, 0], v: [0, 3], t0: 0, t1: 2 * Math.PI, pen: 'thin' },
    { kind: 'arc', center: [x, cy], u: [1.5, 0], v: [0, 1.5], t0: 0, t1: 2 * Math.PI, pen: 'thin' },
  ];
  return projection === 'third' ? [...cone(cx - 4), ...end(cx + 4)] : [...end(cx - 4), ...cone(cx + 4)];
}

const unit = (v: XY): XY => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const add = (a: XY, b: XY, k = 1): XY => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]];
const dot2 = (a: XY, b: XY) => a[0] * b[0] + a[1] * b[1];

/** A filled arrowhead with its tip at `tip`, pointing along `dir`. */
function arrow(tip: XY, dir: XY): Mark {
  const d = unit(dir), n: XY = [-d[1], d[0]], base = add(tip, d, -ARROW);
  return { kind: 'fill', points: [tip, add(base, n, ARROW_HALF), add(base, n, -ARROW_HALF)], head: { style: 'filled', tip, dir: d, length: ARROW, width: 2 * ARROW_HALF } };
}
/** A centre's dot as a head (G24). */
const dot = (c: XY): Mark => ({ kind: 'fill', points: circlePoints(c, 0.4), head: { style: 'dot', tip: c, dir: [1, 0], length: 0.8, width: 0.8 } });

/** Text along a direction, turned to read from below or from the right (angle in (-90°, 90°]). */
function readAngle(dir: XY): number {
  let angle = -Math.atan2(dir[1], dir[0]) * 180 / Math.PI;
  if (angle > 90.001) angle -= 180; else if (angle < -89.999) angle += 180;
  return Math.round(angle * 1000) / 1000;
}

/** A deviation as written: +0.1, -0.05 (an ASCII minus, which every font and PDF encoding has), 0. */
const signed = (v: number, unit: string) => v === 0 ? '0' : (v > 0 ? '+' : '-') + fmtMM(Math.abs(v)) + unit;
/** A tolerance on one line (the panel; ± and fits print so on the sheet too). */
export function toleranceText(t: Tolerance, unit = ''): string {
  return t.kind === 'symmetric' ? `±${fmtMM(t.value)}${unit}` : t.kind === 'fit' ? t.code : `${signed(t.upper, unit)}/${signed(t.lower, unit)}`;
}

/**
 * A dimension's value with its tolerance, as text at `at` (its baseline; `angle` as read): ± and fits
 * follow the value on its line; deviations stack after it in smaller text, the upper one raised.
 */
export function valueMarks(at: XY, angle: number, anchor: 'start' | 'middle' | 'end', value: string, tol?: Tolerance, unit = ''): Mark[] {
  const a = angle * Math.PI / 180, x: XY = [Math.cos(a), -Math.sin(a)], up: XY = [-Math.sin(a), -Math.cos(a)];
  const main = tol && tol.kind !== 'deviation' ? `${value} ${toleranceText(tol, unit)}` : value;
  const small = 2.5, devs = tol?.kind === 'deviation' ? [signed(tol.upper, unit), signed(tol.lower, unit)] : null;
  const wMain = textWidth(main, TEXT, false), wDev = devs ? 0.8 + Math.max(...devs.map(d => textWidth(d, small, false))) : 0, total = wMain + wDev;
  const from = add(at, x, anchor === 'start' ? 0 : anchor === 'middle' ? -total / 2 : -total);
  const marks: Mark[] = [{ kind: 'text', at: from, text: main, size: TEXT, anchor: 'start', ...(angle ? { angle } : {}) }];
  if (devs) {
    const col = add(from, x, wMain + 0.8);
    marks.push({ kind: 'text', at: add(col, up, 1.5), text: devs[0], size: small, anchor: 'start', ...(angle ? { angle } : {}) },
      { kind: 'text', at: add(col, up, -0.6), text: devs[1], size: small, anchor: 'start', ...(angle ? { angle } : {}) });
  }
  return marks;
}

export function dimensionMarks(v: ViewPlacement, r: Extract<Resolved, { ok: true }>): Mark[] {
  if (r.kind === 'pcd') {
    // A pitch circle (R14.5): the circle in chain line through the holes' centres, a leader to it like a diameter's.
    const C = toSheet(v, r.center), R = r.radius * v.scale;
    const asDiameter = { ...r, kind: 'diameter', dim: { ...r.dim, kind: 'diameter', edge: '', near: [0, 0, 0] } } as unknown as Extract<Resolved, { ok: true; kind: 'diameter' }>;
    return [{ kind: 'arc', center: C, u: [R, 0], v: [0, R], t0: 0, t1: 2 * Math.PI, pen: 'center', role: 'dimension' }, ...dimensionMarks(v, asDiameter)];
  }
  const marks: Mark[] = [];
  const place = toSheet(v, r.dim.place);
  if (r.kind === 'angle') {
    // An arc about the vertex through the placement, between the two rays; arrows at its ends, extension
    // lines out from the edges when the arc lies beyond them, the value just outside its middle.
    const X = toSheet(v, r.vertex), R = Math.hypot(place[0] - X[0], place[1] - X[1]);
    const f: XY = [r.from[0], -r.from[1]], g: XY = [-r.from[1], -r.from[0]], theta = r.value * Math.PI / 180;
    const u: XY = [f[0] * R, f[1] * R], w: XY = [g[0] * R, g[1] * R];
    const at = (t: number): XY => [X[0] + u[0] * Math.cos(t) + w[0] * Math.sin(t), X[1] + u[1] * Math.cos(t) + w[1] * Math.sin(t)];
    const tangent = (t: number): XY => [-u[0] * Math.sin(t) + w[0] * Math.cos(t), -u[1] * Math.sin(t) + w[1] * Math.cos(t)];
    marks.push({ kind: 'arc', center: X, u, v: w, t0: 0, t1: theta, pen: 'thin', role: 'dimension' });
    const t0 = tangent(0), t1 = tangent(theta);
    marks.push(arrow(at(0), [-t0[0], -t0[1]]), arrow(at(theta), t1));
    for (const dir of [r.from, r.to]) {
      // The extension along a ray reaches out from the edge end lying along it (none along the ray behind it).
      const d: XY = [dir[0], -dir[1]], reach = Math.max(0, ...r.ends.map(e => { const E = toSheet(v, e), q = (E[0] - X[0]) * d[0] + (E[1] - X[1]) * d[1]; return Math.abs((E[0] - X[0]) * d[1] - (E[1] - X[1]) * d[0]) < 1e-6 * (1 + Math.abs(q)) ? q : 0; }));
      if (R > reach + GAP) marks.push({ kind: 'line', a: add(X, d, reach + GAP), b: add(X, d, R + OVER), pen: 'thin', role: 'extension' });
    }
    const mid = at(theta / 2), out = unit(sub(mid, X));
    marks.push(...valueMarks(add(add(mid, out, 2.5), [0, 1.2]), 0, out[0] > 0.3 ? 'start' : out[0] < -0.3 ? 'end' : 'middle', r.text, r.dim.tol, '°'));
    return marks;
  }
  if (r.kind === 'linear') {
    const A = toSheet(v, r.a), B = toSheet(v, r.b), orient = r.dim.orient;
    const d: XY = orient === 'horizontal' ? [1, 0] : orient === 'vertical' ? [0, 1] : unit(sub(B, A)), n: XY = [-d[1], d[0]];
    const A2 = add(A, n, dot2(sub(place, A), n)), B2 = add(B, n, dot2(sub(place, B), n));
    for (const [P, Q] of [[A, A2], [B, B2]] as const) {
      const out = sub(Q, P), l = Math.hypot(out[0], out[1]);
      if (l > GAP) { const e = unit(out); marks.push({ kind: 'line', a: add(P, e, GAP), b: add(Q, e, OVER), pen: 'thin', role: 'extension' }); }
    }
    const along = sub(B2, A2), len = Math.hypot(along[0], along[1]), e = unit(along);
    if (len >= 2 * ARROW + 1) {
      marks.push({ kind: 'line', a: A2, b: B2, pen: 'thin', role: 'dimension' }, arrow(A2, [-e[0], -e[1]]), arrow(B2, e));
    } else {
      // Too short for arrows inside: arrows outside, pointing in.
      marks.push({ kind: 'line', a: add(A2, e, -ARROW - 3), b: add(B2, e, ARROW + 3), pen: 'thin', role: 'dimension' }, arrow(A2, e), arrow(B2, [-e[0], -e[1]]));
    }
    // Text over the line (the side away from the measured points' middle when the line is beside them).
    const mid = add(A2, along, 0.5), up: XY = textUp(e);
    marks.push(...valueMarks(add(mid, up, 1.2), readAngle(e), 'middle', r.text, r.dim.tol));
    return marks;
  }
  const C = toSheet(v, r.center), R = r.radius * v.scale, toPlace = sub(place, C), dist = Math.hypot(toPlace[0], toPlace[1]);
  const e = dist > 1e-9 ? unit(toPlace) : [1, 0] as XY, rim = add(C, e, R);
  if (dist > R + 1) {
    // A leader from the rim out to the text, with a short shoulder.
    const start = r.kind === 'radius' ? C : rim;
    marks.push({ kind: 'line', a: start, b: place, pen: 'thin', role: 'leader' });
    marks.push(r.kind === 'radius' ? arrow(rim, e) : arrow(rim, [-e[0], -e[1]]));
    const right = e[0] >= 0, shoulder = add(place, [right ? 1 : -1, 0], 3);
    marks.push({ kind: 'line', a: place, b: shoulder, pen: 'thin', role: 'leader' });
    marks.push(...valueMarks(add(shoulder, [right ? 1 : -1, 0], 0.8), 0, right ? 'start' : 'end', r.text, r.dim.tol));
    if (r.kind === 'radius') marks.push(dot(C));
    return marks;
  }
  // Inside the circle: a diameter across it (or a radius from the centre), text along it.
  const far = add(C, e, -R);
  if (r.kind === 'diameter') marks.push({ kind: 'line', a: far, b: rim, pen: 'thin', role: 'dimension' }, arrow(rim, e), arrow(far, [-e[0], -e[1]]));
  else marks.push({ kind: 'line', a: C, b: rim, pen: 'thin', role: 'dimension' }, arrow(rim, e), dot(C));
  const mid = r.kind === 'diameter' ? add(C, e, R * 0.45) : add(C, e, R * 0.5);
  marks.push(...valueMarks(add(mid, textUp(e), 1.2), readAngle(e), 'middle', r.text, r.dim.tol));
  return marks;
}

/** The side of a line its text sits on: above it (or left of a vertical line), as read. */
function textUp(e: XY): XY {
  let n: XY = [e[1], -e[0]];
  if (n[1] > 1e-9 || (Math.abs(n[1]) <= 1e-9 && n[0] > 0)) n = [-n[0], -n[1]];
  return n;
}

const circlePoints = (c: XY, r: number): XY[] => Array.from({ length: 12 }, (_, k) => [c[0] + r * Math.cos(k * Math.PI / 6), c[1] + r * Math.sin(k * Math.PI / 6)] as XY);

/**
 * A section (O148 X1; A–A as always): the cut part's visible edges (sections show no hidden lines) and its cut faces
 * hatched at 45°; its cutting plane (`cuttingPlane`) in a shown view that sees it edge-on (a front's in the top view, then the right;
 * a top's in the front view, then the right; a right's in the front view, then the top) — a chain line, thick at its
 * ends, with arrows pointing the way the section is seen and its letter at each end.
 */
function sectionMarks(v: SectionPlacement, section: SheetSection): Mark[] {
  const marks: Mark[] = [];
  // (DR-2: broken as its view is: its curves and cut faces outside the bands.)
  const pr = v.breaks ? clipProjectionOutside(section.projection, v.breaks) : section.projection, cut = v.breaks ? clipRingsOutside(section.rings, v.breaks) : null;
  const rings = cut ? cut.rings : section.rings, bodies = cut ? (section.ringBodies ? cut.kept.map(k => section.ringBodies![k]) : undefined) : section.ringBodies;
  for (const e of pr.edges) for (const p of e.pieces) if (p.visible) marks.push(curveMark(v, p.curve, 'visible'));
  if (v.breaks) marks.push(...breakLines(v));
  // (DR-3: a half section's centreline between its cut and its uncut half, 3 mm past its box.)
  if (section.half) {
    const [x0, y0, x1, y1] = v.box, c = toSheet(v, section.half.line === 'vertical' ? [section.half.at, 0] : [0, section.half.at]);
    marks.push(section.half.line === 'vertical' ? { kind: 'line', a: [c[0], y0 - 3], b: [c[0], y1 + 3], pen: 'center' } : { kind: 'line', a: [x0 - 3, c[1]], b: [x1 + 3, c[1]], pen: 'center' });
  }
  // (Each body its own hatch — the part's body k at HATCH_ANGLES[k], so adjacent parts read apart, and a body the same in
  // every section; one body alone at 45° as always.)
  for (const g of hatchGroups(rings, bodies)) marks.push({ kind: 'hatch', rings: g.rings.map(r => r.map(q => toSheet(v, q))), spacing: g.spacing, angle: g.angle, pen: 'thin' });
  return marks;
}
/** A section's cutting plane, in the first shown view that sees it edge-on (none shown: none). */
function cuttingPlane(layout: SheetLayout, views: DrawingViews, section: SheetSection, orientation?: Orientation): MarkGroup | null {
  if (section.dir) return alignedCuttingPlane(layout, views, section, orientation);
  if (section.steps) return steppedCuttingPlane(layout, views, section, orientation);
  const marks: Mark[] = [];
  const { k, sign, d } = sectionDepth(section.view, orientation), plane = sign * section.at;
  const showing = (CUT_SHOWN[section.view] as readonly ViewId[]).find(id => !layout.views[id].hidden);
  if (!showing) return null;
  const w = layout.views[showing], pr = views[showing], pad = 6 / w.scale, across = Math.abs(pr.up[k]) > 0.5;
  // (Edge-on: the plane is a line of constant v (across the view) or of constant u (up it), at the plane's place.)
  const a = across ? toSheet(w, [pr.min[0] - pad, pr.up[k] * plane]) : toSheet(w, [pr.right[k] * plane, pr.max[1] + pad]);
  const b = across ? toSheet(w, [pr.max[0] + pad, pr.up[k] * plane]) : toSheet(w, [pr.right[k] * plane, pr.min[1] - pad]);
  const seen: XY = [d[0] * pr.right[0] + d[1] * pr.right[1] + d[2] * pr.right[2], -(d[0] * pr.up[0] + d[1] * pr.up[1] + d[2] * pr.up[2])];
  marks.push({ kind: 'line', a, b, pen: 'center' });
  const t: XY = across ? [1, 0] : [0, 1];
  for (const [end, inward] of [[a, 1], [b, -1]] as const) {
    marks.push({ kind: 'line', a: end, b: [end[0] + inward * 5 * t[0], end[1] + inward * 5 * t[1]], pen: 'frame' });
    const foot: XY = [end[0] + inward * 2 * t[0], end[1] + inward * 2 * t[1]], tip: XY = [foot[0] + 7 * seen[0], foot[1] + 7 * seen[1]];
    marks.push({ kind: 'line', a: foot, b: [tip[0] - ARROW * seen[0], tip[1] - ARROW * seen[1]], pen: 'thin' }, arrow(tip, seen));
    marks.push(across
      ? { kind: 'text', at: [tip[0] - inward * 2.5, tip[1] + 2], text: section.id, size: TEXT, anchor: inward > 0 ? 'end' : 'start', bold: true }
      : { kind: 'text', at: [tip[0] + 2.5 * seen[0], tip[1] - inward * 2.5 + 1.2], text: section.id, size: TEXT, anchor: seen[0] > 0 ? 'start' : 'end', bold: true });
  }
  return { role: 'section', id: section.id, view: showing, marks };
}
/**
 * An aligned section's cutting plane (O178): in the first shown view whose depth is square to the plane's normal, the
 * line dot(p, d) = at across the view (u·(right·d) + v·(up·d) = at), padded past the part; its ends' arrows point along
 * the normal as seen in that view, the section's letter by each. None shown that sees it edge-on: none.
 */
function alignedCuttingPlane(layout: SheetLayout, views: DrawingViews, section: SheetSection, orientation?: Orientation): MarkGroup | null {
  const { d } = sectionFrame(section, orientation);
  const showing = (['front', 'top', 'right'] as const).find(id => { if (layout.views[id].hidden) return false; const t = views[id].toward; return Math.abs(t[0] * d[0] + t[1] * d[1] + t[2] * d[2]) < 1e-6; });
  if (!showing) return null;
  const w = layout.views[showing], pr = views[showing], pad = 6 / w.scale;
  const a = pr.right[0] * d[0] + pr.right[1] * d[1] + pr.right[2] * d[2], b = pr.up[0] * d[0] + pr.up[1] * d[1] + pr.up[2] * d[2];
  // (The line's points in view coordinates: its foot nearest the origin, along its direction; clipped to the padded box.)
  const n2 = a * a + b * b, foot: XY = [a * section.at / n2, b * section.at / n2], along: XY = [-b / Math.sqrt(n2), a / Math.sqrt(n2)];
  const box = [pr.min[0] - pad, pr.min[1] - pad, pr.max[0] + pad, pr.max[1] + pad];
  let t0 = -Infinity, t1 = Infinity;
  for (const k of [0, 1] as const) {
    const lo = box[k], hi = box[k + 2];
    if (Math.abs(along[k]) < 1e-12) { if (foot[k] < lo || foot[k] > hi) return null; continue; }
    const p = (lo - foot[k]) / along[k], q = (hi - foot[k]) / along[k];
    t0 = Math.max(t0, Math.min(p, q)); t1 = Math.min(t1, Math.max(p, q));
  }
  if (!(t0 < t1)) return null;
  const A = toSheet(w, [foot[0] + t0 * along[0], foot[1] + t0 * along[1]]), B = toSheet(w, [foot[0] + t1 * along[0], foot[1] + t1 * along[1]]);
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]), t: XY = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
  // (Seen: the normal in sheet coordinates — the sheet's y down — the way the arrows point.)
  const sl = Math.hypot(a, b), seen: XY = [a / sl, -b / sl];
  const marks: Mark[] = [{ kind: 'line', a: A, b: B, pen: 'center' }];
  for (const [end, inward] of [[A, 1], [B, -1]] as const) {
    marks.push({ kind: 'line', a: end, b: [end[0] + inward * 5 * t[0], end[1] + inward * 5 * t[1]], pen: 'frame' });
    const f: XY = [end[0] + inward * 2 * t[0], end[1] + inward * 2 * t[1]], tip: XY = [f[0] + 7 * seen[0], f[1] + 7 * seen[1]];
    marks.push({ kind: 'line', a: f, b: [tip[0] - ARROW * seen[0], tip[1] - ARROW * seen[1]], pen: 'thin' }, arrow(tip, seen));
    marks.push({ kind: 'text', at: [tip[0] + 2.5 * seen[0] - inward * 2.5 * t[0], tip[1] + 2.5 * seen[1] - inward * 2.5 * t[1] + 1.2], text: section.id, size: TEXT, anchor: 'middle', bold: true });
  }
  return { role: 'section', id: section.id, view: showing, marks };
}
/**
 * An offset section's cutting line (DR-3): in the first shown view that sees its planes edge-on, a chain line along the
 * section view's axis at each plane's depth over its band, stepping square across at each step's place; thick at its ends
 * and at each bend, the arrows at its ends pointing the way it is seen, the letter by each.
 */
function steppedCuttingPlane(layout: SheetLayout, views: DrawingViews, section: SheetSection, orientation?: Orientation): MarkGroup | null {
  const showing = (CUT_SHOWN[section.view] as readonly ViewId[]).find(id => !layout.views[id].hidden);
  if (!showing) return null;
  const w = layout.views[showing], pr = views[showing], { d } = sectionDepth(section.view, orientation), axis = section.along === 'vertical' ? 1 : 0;
  const a3 = axis === 0 ? section.projection.right : section.projection.up, pad = 6 / w.scale;
  // (A model point at the section view's coordinate p along its axis and at depth t, in the showing view.)
  const at = (p: number, t: number): XY => { const q = [a3[0] * p + d[0] * t, a3[1] * p + d[1] * t, a3[2] * p + d[2] * t]; return toSheet(w, [q[0] * pr.right[0] + q[1] * pr.right[1] + q[2] * pr.right[2], q[0] * pr.up[0] + q[1] * pr.up[1] + q[2] * pr.up[2]]); };
  const steps = section.steps ?? [], lo = section.projection.min[axis] - pad, hi = section.projection.max[axis] + pad;
  const pts: XY[] = [at(lo, section.at)];
  let depth = section.at;
  for (const st of steps) { pts.push(at(st.past, depth), at(st.past, st.at)); depth = st.at; }
  pts.push(at(hi, depth));
  const marks: Mark[] = [{ kind: 'polyline', points: pts, pen: 'center' }];
  const seen = unit([d[0] * pr.right[0] + d[1] * pr.right[1] + d[2] * pr.right[2], -(d[0] * pr.up[0] + d[1] * pr.up[1] + d[2] * pr.up[2])]);
  // (Thick at each bend, 2.5 mm along both legs.)
  for (let i = 1; i + 1 < pts.length; i++) for (const o of [pts[i - 1], pts[i + 1]]) marks.push({ kind: 'line', a: pts[i], b: add(pts[i], unit(sub(o, pts[i])), 2.5), pen: 'frame' });
  for (const [end, next] of [[pts[0], pts[1]], [pts[pts.length - 1], pts[pts.length - 2]]] as const) {
    const t = unit(sub(next, end));
    marks.push({ kind: 'line', a: end, b: add(end, t, 5), pen: 'frame' });
    const foot = add(end, t, 2), tip = add(foot, seen, 7);
    marks.push({ kind: 'line', a: foot, b: add(tip, seen, -ARROW), pen: 'thin' }, arrow(tip, seen));
    marks.push({ kind: 'text', at: [tip[0] + 2.5 * seen[0] - 2.5 * t[0], tip[1] + 2.5 * seen[1] - 2.5 * t[1] + 1.2], text: section.id, size: TEXT, anchor: 'middle', bold: true });
  }
  return { role: 'section', id: section.id, view: showing, marks };
}
/** The views that may show a section's cutting plane edge-on, in the order tried. */
const CUT_SHOWN: Record<SectionViewId, readonly ViewId[]> = { front: ['top', 'right'], top: ['front', 'right'], right: ['front', 'top'] };

/** Parallel hatch lines `spacing` apart at `angle` (45° by default) over rings (even–odd: holes stay clear). */
export function hatch(rings: readonly (readonly XY[])[], spacing: number, angle = 45): Extract<Mark, { kind: 'line' }>[] {
  // In coordinates turned by −angle, the hatch lines are horizontal: scan them and pair the crossings. (45° as it always
  // was, √½ both ways, so its lines stay the same to the last digit.)
  const t = angle * Math.PI / 180, cs = angle === 45 ? Math.SQRT1_2 : Math.cos(t), sn = angle === 45 ? Math.SQRT1_2 : Math.sin(t);
  const to = (p: XY): XY => [cs * p[0] + sn * p[1], -sn * p[0] + cs * p[1]], back = (q: XY): XY => [cs * q[0] - sn * q[1], sn * q[0] + cs * q[1]];
  const rs = rings.map(r => r.map(to)), ys = rs.flat().map(p => p[1]);
  if (!ys.length) return [];
  const marks: Extract<Mark, { kind: 'line' }>[] = [], lo = Math.min(...ys), hi = Math.max(...ys);
  for (let yy = Math.ceil(lo / spacing) * spacing; yy <= hi; yy += spacing) {
    const xs: number[] = [];
    for (const r of rs) for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length];
      if ((p[1] <= yy) !== (q[1] <= yy)) xs.push(p[0] + (yy - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 1e-9) marks.push({ kind: 'line', a: back([xs[i], yy]), b: back([xs[i + 1], yy]), pen: 'thin' });
  }
  return marks;
}

export const NOTE_LINE = 5;
/** A note's lines (top left at `at`) and its leader: from the nearer end of the first line, a short shoulder, then out to an arrow on the view point. */
export function noteMarks(layout: SheetLayout, n: DrawingNote): Mark[] {
  const lines = n.text.split('\n'), marks: Mark[] = lines.map((t, k) => ({ kind: 'text', at: [n.at[0], n.at[1] + TEXT * 0.85 + k * NOTE_LINE] as XY, text: t, size: TEXT, anchor: 'start' }));
  if (n.leader && !layout.views[n.leader.view].hidden) {
    const tip = toSheet(layout.views[n.leader.view], n.leader.at), w = Math.max(0, ...lines.map(t => textWidth(t, TEXT, false)));
    const y = n.at[1] + TEXT * 0.45, left = tip[0] < n.at[0] + w / 2, start: XY = left ? [n.at[0] - 1, y] : [n.at[0] + w + 1, y], knee: XY = [start[0] + (left ? -3 : 3), y];
    marks.push({ kind: 'line', a: start, b: knee, pen: 'thin' }, { kind: 'line', a: knee, b: tip, pen: 'thin' }, arrow(tip, sub(tip, knee)));
  }
  return marks;
}

// ---------------------------------------------------------------------------------------------------------
// Geometric tolerancing (R14.4, O5)

/** A box round a dimension's text (its first text): a basic (theoretically exact) dimension. */
export function basicBox(marks: readonly Mark[]): Mark[] {
  const t = marks.find((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
  if (!t) return [];
  const q = textCorners(t.at, t.text, t.size, t.anchor, t.angle ?? 0, !!t.bold), pad = 0.8;
  // Grown by `pad` along the text's own axes.
  const ux = unit(sub(q[1], q[0])), uy = unit(sub(q[3], q[0]));
  const p0 = add(add(q[0], ux, -pad), uy, -pad), p1 = add(add(q[1], ux, pad), uy, -pad), p2 = add(add(q[2], ux, pad), uy, pad), p3 = add(add(q[3], ux, -pad), uy, pad);
  return [{ kind: 'polyline', points: [p0, p1, p2, p3, p0], pen: 'thin', role: 'frame' }];
}

/** Sheet mm: a datum symbol's box, its triangle's base and height. */
const DATUM_BOX = 6, DATUM_BASE = 3, DATUM_HEIGHT = 2.6;
/** A datum feature symbol: its letter boxed at its place, a leader to a filled triangle on its edge (null: the edge is gone). */
export function datumMarks(layout: SheetLayout, views: DrawingViews, d: DrawingDatum): Mark[] | null {
  const v = layout.views[d.view], line = resolveLine(views[d.view], d.edge);
  if (!line) return null;
  const a = toSheet(v, line[0]), b = toSheet(v, line[1]), P = toSheet(v, d.place), ab = sub(b, a), l2 = dot2(ab, ab);
  if (l2 < 1e-12) return null;
  // The foot on the edge nearest the box, kept off its ends; past an end, on the edge's extension line (drawn).
  const t0 = dot2(sub(P, a), ab) / l2, past = t0 < 0 || t0 > 1, t = past ? t0 : Math.max(0.1, Math.min(0.9, t0)), F = add(a, ab, t), e = unit(ab);
  let n: XY = [-e[1], e[0]]; if (dot2(sub(P, F), n) < 0) n = [-n[0], -n[1]];
  const apex = add(F, n, DATUM_HEIGHT), h = DATUM_BOX / 2;
  const extension: Mark[] = past ? [{ kind: 'line', a: add(t0 < 0 ? a : b, e, t0 < 0 ? -1 : 1), b: add(F, e, t0 < 0 ? -(DATUM_BASE / 2 + 1) : DATUM_BASE / 2 + 1), pen: 'thin', role: 'extension' }] : [];
  const marks: Mark[] = [...extension,
    { kind: 'fill', points: [add(F, e, DATUM_BASE / 2), add(F, e, -DATUM_BASE / 2), apex], head: { style: 'filled', tip: F, dir: [-n[0], -n[1]], length: DATUM_HEIGHT, width: DATUM_BASE } },
    { kind: 'polyline', points: [[P[0] - h, P[1] - h], [P[0] + h, P[1] - h], [P[0] + h, P[1] + h], [P[0] - h, P[1] + h], [P[0] - h, P[1] - h]], pen: 'thin', role: 'frame' },
    { kind: 'text', at: [P[0], P[1] + 1.3], text: d.letter, size: TEXT, anchor: 'middle' },
  ];
  // The leader from the box's edge to the triangle's apex.
  const dir = sub(apex, P), m = Math.max(Math.abs(dir[0]), Math.abs(dir[1]));
  if (m > h + 0.5) marks.push({ kind: 'line', a: add(P, dir, h / m), b: apex, pen: 'thin', role: 'leader' });
  return marks;
}

/** Sheet mm: a frame's height and its symbol and datum cells' widths. */
const FRAME_H = 6, FRAME_SYMBOL = 7, FRAME_DATUM = 6;
/** A feature control frame under a text: the position symbol, Ø and the value, the datums in order. */
export function frameMarks(under: Extract<Mark, { kind: 'text' }>, f: DrawingFrame): Mark[] {
  const q = textCorners(under.at, under.text, under.size, under.anchor, 0, !!under.bold);
  const x0 = Math.min(q[0][0], q[3][0]), y0 = under.at[1] + 1.6, value = `Ø${fmtMM(f.value)}`, vw = textWidth(value, TEXT, false) + 2.5;
  const cells = [FRAME_SYMBOL, vw, ...f.datums.map(() => FRAME_DATUM)], x1 = x0 + cells.reduce((s, w) => s + w, 0), y1 = y0 + FRAME_H;
  const marks: Mark[] = [{ kind: 'polyline', points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], pen: 'thin', role: 'frame' }];
  let x = x0;
  cells.forEach((w, k) => { if (k) marks.push({ kind: 'line', a: [x, y0], b: [x, y1], pen: 'thin', role: 'frame' }); x += w; });
  // The position symbol: a circle with a cross through it.
  const c: XY = [x0 + FRAME_SYMBOL / 2, y0 + FRAME_H / 2], r = 1.7, arm = 2.3;
  marks.push({ kind: 'arc', center: c, u: [r, 0], v: [0, r], t0: 0, t1: 2 * Math.PI, pen: 'thin', role: 'frame' }, { kind: 'line', a: [c[0] - arm, c[1]], b: [c[0] + arm, c[1]], pen: 'thin', role: 'frame' }, { kind: 'line', a: [c[0], c[1] - arm], b: [c[0], c[1] + arm], pen: 'thin', role: 'frame' });
  marks.push({ kind: 'text', at: [x0 + FRAME_SYMBOL + vw / 2, y0 + 4.5], text: value, size: TEXT, anchor: 'middle' });
  f.datums.forEach((l, k) => marks.push({ kind: 'text', at: [x0 + FRAME_SYMBOL + vw + FRAME_DATUM * (k + 0.5), y0 + 4.5], text: l, size: TEXT, anchor: 'middle' }));
  return marks;
}
