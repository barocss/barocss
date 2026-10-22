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
import { roundIn } from './dimensions';
import { drawingIssues, fixAll, issueContext, type DrawingIssue, type SheetInputs } from './issues';
import { sectionExtents } from './sheet';
import { ORIENTATIONS, SCALES, layoutSheet, viewsFor, type Orientation } from './views';
import { ROOM_SIDES, VIEW_IDS, type DrawingSettings, type DrawingViews, type ViewId, type ViewRoom } from './types';

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
  if (settings.orientation || settings.dimensions.some(d => !d.auto) || (settings.notes ?? []).some(n => n.leader) || (settings.datums ?? []).length) return null;
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
        const auto = autoDimensions(i.views, layout, s, i.callout, i.elements, i.sections), placed: DrawingSettings = withElementNotes({ ...s, dimensions: auto.dimensions }, i.elements ? elementNotes(i.views, layout, i.elements) : []);
        // Once every side has room: the issue list's moves for what still overlaps (a short dimension's text, a callout
        // over lines). While a side is crowded, more room comes first.
        const moved = auto.report.crowded.length ? { settings: placed, left: drawingIssues(issueContext({ ...i, settings: placed })) } : fixAll({ ...i, settings: placed }, 40, f => f.kind === 'move' || f.kind === 'move-note');
        const done = moved.settings, left = moved.left, errors = left.filter(x => x.severity === 'error').length + auto.report.crowded.length;
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
