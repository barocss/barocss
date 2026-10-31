// Auto layout (R14.3, O4): the views chosen and laid out so their dimensions have room, then Auto-dimension.
//
// - Views: the front and top views always; the right view dropped when it adds nothing (no circle shows round in it,
//   no curve, every straight edge's position already in the top or front view, nothing placed in it by hand); the
//   isometric view as set.
// - Room: Auto-dimension says how much sheet room each view side's rows take; the layout spaces the views by it
//   (`settings.room`), and the two run in turn until every side has its rows (at most four rounds). What still overlaps
//   after a round gets the issue list's moves.
// - Scale and sheet: first the scales at which the smallest hole is at least MIN_HOLE_ON_PAPER_MM across on paper,
//   largest first (or the one set), on the sheet set then A3 for an A4 sheet: the first giving nothing crowded and no
//   error on the issue list. Only if none: the largest clean scale below them. Else the attempt with the fewest errors.
import { elementNotes, withElementNotes } from './elementCallouts';
import { autoDimensions, holesOf, levels, type AutoDimensionReport } from './auto';
import { roundIn, type Resolved } from './dimensions';
import { drawingIssues, fixAll, issueContext, quadsOverlap, segmentHitsQuad, SegmentGrid, textBox, type DrawingIssue, type IssueContext, type Quad, type SheetInputs } from './issues';
import { presetOf } from './standard';
import { basicBox, dimensionMarks, frameMarks, placementOf, sectionExtents, type Mark } from './sheet';
import { ORIENTATIONS, SCALES, layoutSheet, viewsFor, type Orientation } from './views';
import { ROOM_SIDES, VIEW_IDS, type DimView, type DrawingSettings, type DrawingViews, type ViewId, type ViewRoom, type XY } from './types';

export const AUTO_LAYOUT_VERSION = 'cad-studio-auto-layout-v1';

const ROUNDS = 4;
const SAME = 1e-6;
/**
 * The smallest hole's diameter on paper (mm) for a layout to read well. An estimate (O4), not from a standard: below
 * it a hole's centre lines, leader and callout crowd it. A clean layout below it is taken only when no readable one is.
 */
export const MIN_HOLE_ON_PAPER_MM = 2.5;

export interface AutoLayoutReport {
  contract: typeof AUTO_LAYOUT_VERSION;
  views: ViewId[]; dropped: ViewId[];
  scale: number; sheet: DrawingSettings['sheet'];
  /** Layouts tried (each a round of layout and Auto-dimension). */
  tried: number;
  dimensions: AutoDimensionReport;
  /** What is left on the issue list (none when it found a clean drawing). */
  left: DrawingIssue[];
  /** Whether the smallest hole is MIN_HOLE_ON_PAPER_MM or more on paper (false: no clean layout reads so well). */
  readable: boolean;
}

const near = (a: number, b: number) => Math.abs(a - b) <= SAME * Math.max(1, Math.abs(a), Math.abs(b));
const inAll = (xs: readonly number[], ys: readonly number[]) => xs.every(x => ys.some(y => near(x, y)));

/** Whether the right view shows anything the front and top views do not (for a part they show whole). */
export function rightAddsNothing(views: DrawingViews): boolean {
  const right = views.right, top = views.top, front = views.front;
  for (const e of right.edges) {
    if (!e.pieces.some(p => p.visible)) continue;
    if (e.circle && roundIn(right, e)) return false;
    if (e.kind === 'curve' || (e.circle && !e.ends)) return false;
  }
  // Its straight edges' positions: across (model Y) among the top view's, up (model Z) among the front view's.
  const across = [...levels(right, 0).map(m => m.x), right.min[0], right.max[0]], up = [...levels(right, 1).map(m => m.x), right.min[1], right.max[1]];
  const topY = [...levels(top, 1).map(m => m.x), top.min[1], top.max[1]], frontZ = [...levels(front, 1).map(m => m.x), front.min[1], front.max[1]];
  return inAll(across, topY) && inAll(up, frontZ);
}

/** The views to show: as set, less a right view that adds nothing and holds nothing placed by hand. */
export function chooseViews(views: DrawingViews, settings: DrawingSettings): { views: ViewId[]; dropped: ViewId[] } {
  const base = settings.views ?? [...VIEW_IDS];
  const handInRight = settings.dimensions.some(d => d.view === 'right' && !d.auto) || (settings.notes ?? []).some(n => n.leader?.view === 'right');
  if (base.includes('right') && !handInRight && rightAddsNothing(views)) return { views: base.filter(v => v !== 'right'), dropped: ['right'] };
  return { views: base, dropped: [] };
}

/**
 * How much a view tells (R14.3b, O7): its visible edges, each circle that shows round three times over, less half
 * its hidden ones (a view with fewer hidden lines reads better).
 */
export function information(pr: DrawingViews['front']): number {
  let visible = 0, hidden = 0, round = 0;
  for (const e of pr.edges) for (const p of e.pieces) { if (p.visible) visible++; else hidden++; }
  const seen = new Set<string>();
  for (const e of pr.edges) if (e.circle && roundIn(pr, e)) { const k = e.circle.center.map(x => Math.round(x * 1e6)).join(',') + `|${Math.round(e.circle.radius * 1e6)}`; if (!seen.has(k)) { seen.add(k); round++; } }
  return visible + 3 * round - 0.5 * hidden;
}

/**
 * The front view's side for Auto (R14.3b, O7): the side the right view looks from, when it tells clearly more than the
 * front (a fifth more, and two more); else the front as it is. Only for a drawing that has no side set and nothing
 * placed by hand on it (a side set, or annotations to keep, stay as they are). Null: keep the front.
 */
export function frontByInformation(views: DrawingViews, settings: DrawingSettings): { orientation: Orientation; why: string } | null {
  if (settings.orientation || settings.dimensions.some(d => !d.auto) || (settings.notes ?? []).some(n => n.leader) || (settings.datums ?? []).length || settings.frames?.some(f => f.dim === undefined)) return null;
  const front = information(views.front), right = information(views.right);
  if (!(right > 1.2 * front && right > front + 2)) return null;
  const t = views.right.toward, orientation = ORIENTATIONS.find(o => { const v = viewsFor(o).front.toward; return Math.abs(v[0] - t[0]) < 1e-9 && Math.abs(v[1] - t[1]) < 1e-9; })!;
  return { orientation, why: `the side now seen as the right view shows more (${Math.round(right)} against ${Math.round(front)}: visible edges, round circles three times, less half the hidden lines)` };
}

/** Room for each side: the larger of what it had and what its rows took, to the next half millimetre. */
function grown(room: ViewRoom, needs: AutoDimensionReport['needs']): ViewRoom {
  const out: ViewRoom = {};
  for (const v of VIEW_IDS) for (const k of ROOM_SIDES) {
    const x = Math.max(room[v]?.[k] ?? 0, needs[v]?.[k] ?? 0);
    if (x > 0) (out[v] ??= {})[k] = Math.ceil(x * 2) / 2;
  }
  return out;
}
const sameRoom = (a: ViewRoom, b: ViewRoom) => JSON.stringify(a) === JSON.stringify(b);

const LABEL_STEP_MM = 2;
const labelIssue = (x: DrawingIssue) => x.code === 'TEXT_OVERLAP' || x.code === 'TEXT_OVER_LINES' || x.code === 'OFF_SHEET';
const rectangle = ([x0, y0, x1, y1]: readonly number[]): Quad => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Segments of the display list, including arrow boundaries; arcs use the issue checker's angular subdivision. */
function labelSegments(marks: readonly Mark[]): [XY, XY][] {
  const out: [XY, XY][] = [];
  for (const m of marks) {
    if (m.kind === 'line') out.push([m.a, m.b]);
    else if (m.kind === 'polyline' || m.kind === 'fill') {
      for (let k = 1; k < m.points.length; k++) out.push([m.points[k - 1], m.points[k]]);
      if (m.kind === 'fill' && m.points.length) out.push([m.points[m.points.length - 1], m.points[0]]);
    } else if (m.kind === 'arc') {
      const n = Math.max(2, Math.ceil(Math.abs(m.t1 - m.t0) / (Math.PI / 16)));
      const at = (t: number): XY => [m.center[0] + m.u[0] * Math.cos(t) + m.v[0] * Math.sin(t), m.center[1] + m.u[1] * Math.cos(t) + m.v[1] * Math.sin(t)];
      for (let k = 1; k <= n; k++) out.push([at(m.t0 + (m.t1 - m.t0) * (k - 1) / n), at(m.t0 + (m.t1 - m.t0) * k / n)]);
    }
  }
  return out;
}

/** Fixed obstacles for one dimension, in sheet mm. Its own control frame moves with it. */
function labelClearance(ctx: IssueContext, id: string, view: DimView): (marks: Mark[]) => boolean {
  const controls = new Set(ctx.settings.frames?.filter(f => f.dim === id).map(f => f.id));
  const held = ctx.sheet.groups.filter(g => g.role !== 'frame' && g.role !== 'title' && !(g.role === 'dimension' && g.id === id) && !(g.role === 'control' && controls.has(g.id!)));
  const boxes = held.flatMap(g => g.marks.flatMap(m => m.kind === 'text' ? [textBox(m)] : []));
  boxes.push(...(ctx.sheet.tables ?? []).map(t => rectangle(t.box)));
  const grid = new SegmentGrid(labelSegments(held.flatMap(g => g.marks)));
  const host = ctx.sheet.sections?.find(s => s.form === 'revolved' && `section:${s.id}` === view)?.on;
  const areas = VIEW_IDS.filter(v => v !== view && v !== host && !ctx.layout.views[v].hidden).map(v => ctx.layout.views[v].box)
    .concat((ctx.layout.sections ?? []).filter(v => `section:${v.section}` !== view).map(v => v.box),
      (ctx.sheet.sections ?? []).filter(v => v.form === 'removed' && `section:${v.id}` !== view).map(v => v.placement.box),
      (ctx.sheet.details ?? []).filter(v => `detail:${v.id}` !== view).map(v => v.placement.box)).map(rectangle);
  const title = rectangle(ctx.layout.title), [x0, y0, x1, y1] = ctx.layout.frame;
  return marks => {
    const text = marks.flatMap(m => m.kind === 'text' ? [textBox(m)] : []), lines = labelSegments(marks);
    const points = [...text.flat(), ...lines.flat()];
    // Extension lines can cross their own part and other dimension lines. They must not cross another text or view.
    return points.every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)
      && text.every(b => !quadsOverlap(b, title, 0) && !boxes.some(q => quadsOverlap(b, q)) && !grid.hits(b) && !areas.some(q => quadsOverlap(b, q, 0)))
      && lines.every(([a, b]) => !segmentHitsQuad(a, b, title, 0) && !boxes.some(q => segmentHitsQuad(a, b, q)) && !areas.some(q => segmentHitsQuad(a, b, q, 0)));
  };
}

/** Additional positions between the existing 8 mm rows. Neither the measurement direction nor its references change. */
function* labelPlaces(r: Extract<Resolved, { ok: true }>, scale: number, reach: number): Generator<XY> {
  const p = r.dim.place;
  if (r.kind === 'linear') {
    const d: XY = r.dim.orient === 'horizontal' ? [1, 0] : r.dim.orient === 'vertical' ? [0, 1] : [r.b[0] - r.a[0], r.b[1] - r.a[1]];
    const len = Math.hypot(...d), n: XY = [-d[1] / len, d[0] / len];
    for (let mm = LABEL_STEP_MM; mm <= reach; mm += LABEL_STEP_MM) for (const sign of [1, -1]) yield [p[0] + sign * n[0] * mm / scale, p[1] + sign * n[1] * mm / scale];
  } else if (r.kind === 'radius' || r.kind === 'diameter') {
    const angle = Math.atan2(p[1] - r.center[1], p[0] - r.center[0]), start = Math.hypot(p[0] - r.center[0], p[1] - r.center[1]) * scale;
    for (let mm = 0; mm <= reach; mm += LABEL_STEP_MM) for (let k = 0; k < 16; k++) {
      if (!mm && !k) continue;
      const a = angle + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8, radius = (start + mm) / scale;
      yield [r.center[0] + Math.cos(a) * radius, r.center[1] + Math.sin(a) * radius];
    }
  }
}

/** Move only automatic labels left in collision. A failed search leaves the dimension and its issue intact. */
export function placeDimensionLabels(initial: IssueContext): { settings: DrawingSettings; left: DrawingIssue[] } {
  let ctx = initial, left = drawingIssues(ctx);
  const ids = [...new Set(left.filter(labelIssue).flatMap(x => x.dims ?? []))];
  for (const id of ids) {
    const r = ctx.sheet.dimensions.find((d): d is Extract<Resolved, { ok: true }> => d.ok && d.dim.id === id);
    if (!r?.dim.auto || !ctx.rebuild || !left.some(x => labelIssue(x) && x.dims?.includes(id))) continue;
    const v = placementOf(ctx.layout, ctx.sheet, r.dim.view);
    // A broken view has a nonlinear model-to-paper map. Keep its existing placement path.
    if (!v || v.breaks?.length || !(v.scale > 0)) continue;
    const clear = labelClearance(ctx, id, r.dim.view), frame = ctx.settings.frames?.find(f => f.dim === id), rebuild = ctx.rebuild;
    const signature = (x: DrawingIssue) => JSON.stringify([x.code, x.severity, x.dims, x.notes, x.tables, x.welds, x.view]);
    const before = left.map(signature);
    for (const place of labelPlaces(r, v.scale, Math.hypot(ctx.layout.frame[2] - ctx.layout.frame[0], ctx.layout.frame[3] - ctx.layout.frame[1]))) {
      const moved = { ...r, dim: { ...r.dim, place } } as Extract<Resolved, { ok: true }>;
      const marks = dimensionMarks(v, moved, presetOf(ctx.settings.standard));
      if (r.dim.basic) marks.push(...basicBox(marks));
      const main = marks.find((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
      if (frame && main) marks.push(...frameMarks(main, frame, presetOf(ctx.settings.standard)));
      if (!clear(marks)) continue;
      const settings = { ...ctx.settings, dimensions: ctx.settings.dimensions.map(d => d.id === id ? { ...d, place } : d) };
      const next = rebuild(settings), own = next.sheet.groups.filter(g => (g.role === 'dimension' && g.id === id) || (g.role === 'control' && next.settings.frames?.some(f => f.id === g.id && f.dim === id))).flatMap(g => g.marks);
      if (!own.length || !labelClearance(next, id, r.dim.view)(own)) continue;
      const issues = drawingIssues(next), remaining = [...before];
      if (issues.some(x => labelIssue(x) && x.dims?.includes(id)) || issues.some(x => { const k = remaining.indexOf(signature(x)); if (k < 0) return true; remaining.splice(k, 1); return false; })) continue;
      ctx = next; left = issues; break;
    }
  }
  return { settings: ctx.settings, left };
}

/** Auto layout: the settings with the views, room, scale and sheet chosen and Auto-dimension's dimensions; what it did. */
export function autoLayout(i: SheetInputs): { settings: DrawingSettings; report: AutoLayoutReport } {
  const { views: shown, dropped } = chooseViews(i.views, i.settings);
  const manual = i.settings.dimensions.filter(d => !d.auto);
  const sheets: DrawingSettings['sheet'][] = i.settings.sheet === 'A4' ? ['A4', 'A3'] : [i.settings.sheet];
  type Attempt = { settings: DrawingSettings; dims: AutoDimensionReport; left: DrawingIssue[]; errors: number };
  let best: Attempt | null = null, clean: Attempt | null = null, tried = 0;
  const smallest = Math.min(Infinity, ...holesOf(i.views, i.callout).map(h => 2 * h.radius));
  // Pass one: scales at which the smallest hole reads (on A4, then A3). Pass two, only if none was clean: the largest
  // clean scale below that.
  for (const readable of [true, false]) for (const sheet of sheets) {
    const base: DrawingSettings = { ...i.settings, sheet, views: shown, dimensions: manual };
    delete base.room; delete base.scale;
    // Scales: the one set (on its own sheet) or the largest that fits the views alone, then the smaller ones.
    const first = sheet === i.settings.sheet && i.settings.scale !== undefined ? i.settings.scale : layoutSheet(i.views, base, sectionExtents(base, i.sections)).scale;
    for (const scale of SCALES.filter(s => s <= first + 1e-12 && (smallest * s >= MIN_HOLE_ON_PAPER_MM - SAME) === readable)) {
      let room: ViewRoom = {};
      for (let round = 0; round < ROUNDS; round++) {
        tried++;
        const s: DrawingSettings = { ...base, scale, ...(Object.keys(room).length ? { room } : {}) };
        const layout = issueContext({ ...i, settings: s }).layout;
        if (!layout.fits) break;
        const auto = autoDimensions(i.views, layout, s, i.callout, i.elements, i.sections, i.locationOwner), placed: DrawingSettings = withElementNotes({ ...s, dimensions: auto.dimensions }, i.elements ? elementNotes(i.views, layout, i.elements) : []);
        // Once every side has room: the issue list's moves for what still overlaps (a short dimension's text, a callout
        // over lines). While a side is crowded, more room comes first.
        const moved = auto.report.crowded.length ? { settings: placed, left: drawingIssues(issueContext({ ...i, settings: placed })) } : fixAll({ ...i, settings: placed }, 40, f => f.kind === 'move' || f.kind === 'move-note');
        const labels = auto.report.crowded.length ? moved : placeDimensionLabels(issueContext({ ...i, settings: moved.settings }));
        const done = labels.settings, left = labels.left, errors = left.filter(x => x.severity === 'error').length + auto.report.crowded.length;
        if (!best || errors < best.errors) best = { settings: done, dims: auto.report, left, errors };
        if (!errors) {
          if (readable) return finish(i, done, auto.report, left, shown, dropped, tried, true);
          clean = { settings: done, dims: auto.report, left, errors };
          break;
        }
        const next = grown(room, auto.report.needs);
        if (sameRoom(next, room)) break;
        room = next;
      }
      if (clean) break;
    }
    if (clean) break;
  }
  const take = clean ?? best!;
  return finish(i, take.settings, take.dims, take.left, shown, dropped, tried, false);
}

/** The chosen settings, the scale left automatic where the layout would pick it anyway. */
function finish(i: SheetInputs, settings: DrawingSettings, dims: AutoDimensionReport, left: DrawingIssue[], views: ViewId[], dropped: ViewId[], tried: number, readable: boolean): { settings: DrawingSettings; report: AutoLayoutReport } {
  const scale = settings.scale!, { scale: _s, ...rest } = settings; void _s;
  const auto = layoutSheet(i.views, rest, sectionExtents(rest, i.sections)).scale;
  const out: DrawingSettings = i.settings.scale === undefined && auto === scale ? rest : settings;
  return { settings: out, report: { contract: AUTO_LAYOUT_VERSION, views, dropped, scale, sheet: settings.sheet, tried, readable, dimensions: dims, left } };
}
