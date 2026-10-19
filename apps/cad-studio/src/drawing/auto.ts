// Auto-dimension (R14.1, O2): dimensions placed from the part's geometry and its features' intent, as ordinary
// drawing dimensions (persistent edge references; they follow the model and can be moved or removed).
//
// - Overall sizes: width and height in the front view, depth in the top view, between edge ends at the views'
//   extremes.
// - Levels: the distinct positions of the visible straight edges inside a view (steps, notches), baseline from the
//   view's left or bottom extreme: across and along in the top view, heights in the front view.
// - Holes: each hole in the first view it shows round in (top, front, right), located from that view's extremes;
//   three or more in a row at one pitch dimensioned as the first and one pitch for all (`3× 20`).
// - Callouts: one diameter per kind of hole, its text the feature's (THRU, DEEP, thread, counterbore, countersink)
//   and the number of such holes (`4× Ø6.6 THRU`); a counterbore's or countersink's outer circle is in it already.
// Each kind stacks in rows beside its view, on the side with more free room; inner rows the shorter; callouts on the
// other side, a row each.
// What it cannot dimension is listed with the reason, never guessed: holes on a circle (their pitch circle) for now.
import type { BrepProjection, ProjectedEdge } from '@barocss/cad';
import { resolveDimension, roundIn, snapPoints, type SnapPoint } from './dimensions';
import type { SheetLayout } from './views';
import type { DimPoint, DrawingDimension, DrawingSettings, DrawingViews, ViewId, XY } from './types';

export const AUTO_DIMENSIONS_VERSION = 'cad-studio-auto-dimensions-v1';

/** Sheet mm: the first row's distance from its view, and the distance between rows. */
const FIRST_ROW = 10, ROW = 8;
/** Sheet mm: a callout's first row past its view, and how far sideways its leader runs past the hole. */
const CALLOUT_ROW = 6, CALLOUT_RUN = 6;
/** Sheet mm left past the outermost row for its text. */
const TEXT_ROOM = 4;
/** Sheet mm a view's name takes under it. */
const LABEL = 7;
/** View-coordinate tolerance for "the same position" (mm). */
const SAME = 1e-6;
const ORTHO: readonly ViewId[] = ['top', 'front', 'right'];

export interface AutoDimensionReport {
  contract: typeof AUTO_DIMENSIONS_VERSION;
  added: { overall: number; levels: number; holePositions: number; pitches: number; callouts: number };
  /** Kept as they were: dimensions placed by hand; and auto ones that a hand-placed one already gives. */
  kept: number;
  skipped: { view: ViewId; what: string; why: string }[];
  /** Sides of a view whose rows need more sheet room than there is at this scale and sheet (they overlap what is next to them). */
  crowded: { view: ViewId; side: 'above' | 'below' | 'left' | 'right'; neededMM: number; roomMM: number }[];
  /** The sheet room (mm) each view side's dimensions take, from the view's edge (a view's name below not counted): what the layout gives room for (R14.3). */
  needs: Partial<Record<ViewId, Record<'above' | 'below' | 'left' | 'right', number>>>;
}

export interface Hole { view: ViewId; at: XY; radius: number; ref: DimPoint; edge: ProjectedEdge; callout: string | null }
type Side = 'above' | 'below' | 'left' | 'right';
type Unplaced = Omit<Extract<DrawingDimension, { kind: 'linear' }>, 'id' | 'place'> | Omit<Extract<DrawingDimension, { kind: 'diameter' | 'radius' }>, 'id' | 'place'>;
interface Planned { dim: Unplaced; row: number; kind: keyof AutoDimensionReport['added']; along: 'u' | 'v' | 'leader'; span: [XY, XY]; radius?: number }

const r6 = (v: number) => Math.round(v / SAME) * SAME;
const sameXY = (a: XY, b: XY) => Math.abs(a[0] - b[0]) <= SAME && Math.abs(a[1] - b[1]) <= SAME;

/** The edge end at a view's extreme along an axis (`k` 0: u, 1: v), the lowest along the other on ties. */
function extreme(snaps: readonly SnapPoint[], k: 0 | 1, max: boolean): SnapPoint | null {
  let best: SnapPoint | null = null;
  for (const s of snaps) {
    if (s.ref.at !== 'end') continue;
    if (!best) { best = s; continue; }
    const d = (s.at[k] - best.at[k]) * (max ? 1 : -1);
    if (d > SAME || (Math.abs(d) <= SAME && s.at[1 - k] < best.at[1 - k] - SAME)) best = s;
  }
  return best;
}

/** Free sheet room beside a view on each side: up to the nearest other view, the section, the title block or the frame. */
function room(layout: SheetLayout, id: ViewId): Record<Side, number> {
  const [x0, y0, x1, y1] = layout.views[id].box, f = layout.frame;
  const others = [...ORTHO.filter(o => o !== id), 'iso' as const].filter(o => !layout.views[o].hidden).map(o => layout.views[o].box).concat(layout.section ? [layout.section.box] : [], [layout.title]);
  const out: Record<Side, number> = { above: y0 - f[1], below: f[3] - y1, left: x0 - f[0], right: f[2] - x1 };
  for (const [a0, b0, a1, b1] of others) {
    const overlapsX = a0 < x1 && a1 > x0, overlapsY = b0 < y1 && b1 > y0;
    if (overlapsX && b1 <= y0) out.above = Math.min(out.above, y0 - b1);
    if (overlapsX && b0 >= y1) out.below = Math.min(out.below, b0 - y1);
    if (overlapsY && a1 <= x0) out.left = Math.min(out.left, x0 - a1);
    if (overlapsY && a0 >= x1) out.right = Math.min(out.right, a0 - x1);
  }
  return out;
}

/** A circle's arcs (by their 3D centre and radius) adding up to a whole turn: one round outline (a hole's rim, a boss). */
interface Circle { c: readonly number[]; r: number; n: readonly number[]; edge: ProjectedEdge; sweep: number }
const keyOf = (c: readonly number[], r: number) => [c[0], c[1], c[2], r].map(r6).join(',');
/** The distance between two centres square to an axis (rims of one hole: 0). */
function across(a: readonly number[], b: readonly number[], n: readonly number[]): number {
  const d0 = a[0] - b[0], d1 = a[1] - b[1], d2 = a[2] - b[2], t = d0 * n[0] + d1 * n[1] + d2 * n[2];
  return Math.hypot(d0 - n[0] * t, d1 - n[1] * t, d2 - n[2] * t);
}

/** The holes of every orthographic view: whole circles that show round, each in the first view it does (by its 3D centre). */
export function holesOf(views: DrawingViews, callout: (edge: string) => string | null): Hole[] {
  const out: Hole[] = [], seen: Circle[] = [];
  for (const id of ORTHO) {
    const pr = views[id], circles = new Map<string, Circle>();
    for (const e of pr.edges) {
      if (!e.circle || !roundIn(pr, e)) continue;
      const k = keyOf(e.circle.center, e.circle.radius), had = circles.get(k);
      if (had) had.sweep += e.circle.sweep;
      else circles.set(k, { c: e.circle.center, r: e.circle.radius, n: e.circle.normal, edge: e, sweep: e.circle.full ? 2 * Math.PI : e.circle.sweep });
    }
    for (const c of circles.values()) {
      if (c.sweep < 2 * Math.PI - 1e-6) continue;
      // Both rims of a hole show as one circle: the same radius, centres along its axis.
      if (seen.some(s => Math.abs(s.r - c.r) <= SAME && across(c.c, s.c, c.n) <= SAME)) continue;
      seen.push(c);
      const at: XY = [c.c[0] * pr.right[0] + c.c[1] * pr.right[1] + c.c[2] * pr.right[2], c.c[0] * pr.up[0] + c.c[1] * pr.up[1] + c.c[2] * pr.up[2]];
      out.push({ view: id, at, radius: c.r, edge: c.edge, ref: { edge: c.edge.name, at: 'center', near: [c.c[0], c.c[1], c.c[2]] }, callout: callout(c.edge.name) });
    }
  }
  return out;
}

/** Positions inside a view along one axis: edge levels and hole centres, each with a reference point. */
export interface Mark { x: number; ref: DimPoint; hole: boolean }

/** Straight visible edges across `k` (constant along it): their position and an end to measure from. */
export function levels(pr: BrepProjection, k: 0 | 1): Mark[] {
  const out: Mark[] = [];
  for (const e of pr.edges) {
    if (!e.ends || e.circle || (e.kind !== 'line' && e.kind !== 'silhouette') || !e.pieces.some(p => p.visible)) continue;
    const a = e.ends[0], b = e.ends[1], ax = a[0] * pr.right[0] + a[1] * pr.right[1] + a[2] * pr.right[2], ay = a[0] * pr.up[0] + a[1] * pr.up[1] + a[2] * pr.up[2];
    const bx = b[0] * pr.right[0] + b[1] * pr.right[1] + b[2] * pr.right[2], by = b[0] * pr.up[0] + b[1] * pr.up[1] + b[2] * pr.up[2];
    const pa = k === 0 ? ax : ay, pb = k === 0 ? bx : by, qa = k === 0 ? ay : ax, qb = k === 0 ? by : bx;
    if (Math.abs(pa - pb) > SAME || Math.abs(qa - qb) <= SAME) continue;
    out.push({ x: pa, ref: { edge: e.name, at: 'end', near: [a[0], a[1], a[2]] }, hole: false });
  }
  return out;
}

/** Runs of three or more hole positions at one pitch (sorted, distinct). */
function pitchRuns(xs: readonly number[]): [number, number][] {
  const runs: [number, number][] = [];
  let i = 0;
  while (i + 2 < xs.length) {
    const p = xs[i + 1] - xs[i];
    let j = i + 1;
    while (j + 1 < xs.length && Math.abs(xs[j + 1] - xs[j] - p) <= 1e-6 * Math.max(1, p)) j++;
    if (j - i >= 2) { runs.push([i, j]); i = j + 1; } else i++;
  }
  return runs;
}

/**
 * The dimensions Auto-dimension gives the part's views, with the hand-placed ones kept and its own earlier ones
 * replaced. `callout`: a hole's callout by an edge of it (null: not a hole feature).
 */
export function autoDimensions(views: DrawingViews, layout: SheetLayout, settings: DrawingSettings, callout: (edge: string) => string | null): { dimensions: DrawingDimension[]; report: AutoDimensionReport } {
  const manual = settings.dimensions.filter(d => !d.auto);
  const report: AutoDimensionReport = { contract: AUTO_DIMENSIONS_VERSION, added: { overall: 0, levels: 0, holePositions: 0, pitches: 0, callouts: 0 }, kept: manual.length, skipped: [], crowded: [], needs: {} };
  const holes = holesOf(views, callout), planned: Record<ViewId, Planned[]> = { front: [], top: [], right: [], iso: [] };
  for (const id of ORTHO) {
    // (A view not shown (R14.3) gets nothing; a hole that shows round only there is the issue list's VIEW_NEEDED.)
    if (layout.views[id].hidden) continue;
    const pr = views[id], snaps = snapPoints(pr), list = planned[id];
    const lo = [extreme(snaps, 0, false), extreme(snaps, 1, false)] as const, hi = [extreme(snaps, 0, true), extreme(snaps, 1, true)] as const;
    const mine = holes.filter(h => h.view === id);
    for (const k of [0, 1] as const) {
      // Overall: width (u) and height (v) in the front view, depth (v) in the top view.
      const overall = (id === 'front') || (id === 'top' && k === 1);
      const atMin = lo[k], atMax = hi[k];
      const extent = (k === 0 ? pr.max[0] - pr.min[0] : pr.max[1] - pr.min[1]);
      const reaches = (s: SnapPoint | null, v: number) => !!s && Math.abs(s.at[k] - v) <= 1e-6 * Math.max(1, extent);
      const okMin = reaches(atMin, pr.min[k]), okMax = reaches(atMax, pr.max[k]);
      if (overall) {
        if (okMin && okMax) list.push({ dim: linear(id, atMin!.ref, atMax!.ref, k), row: 1000, kind: 'overall', along: k === 0 ? 'u' : 'v', span: [atMin!.at, atMax!.at] });
        else report.skipped.push({ view: id, what: k === 0 ? 'overall width' : id === 'front' ? 'overall height' : 'overall depth', why: 'no edge end at the view’s extreme (a round outline: its diameter gives the size)' });
      }
      // Positions: levels (top: both ways; front: heights) and this view's holes, from the low extreme.
      const wantLevels = id === 'top' || (id === 'front' && k === 1);
      if (!okMin || (!wantLevels && !mine.length)) { if (mine.length && !okMin) report.skipped.push({ view: id, what: `${mine.length} hole position${mine.length > 1 ? 's' : ''} ${k === 0 ? 'across' : 'up'}`, why: 'no edge end at the view’s extreme to measure from' }); continue; }
      const marks: Mark[] = [...(wantLevels ? levels(pr, k) : []), ...mine.map(h => ({ x: h.at[k], ref: h.ref, hole: true }))]
        .filter(m => m.x > pr.min[k] + SAME && m.x < pr.max[k] - SAME);
      // One mark a position, a hole's centre before an edge.
      marks.sort((a, b) => a.x - b.x || Number(b.hole) - Number(a.hole));
      const at: Mark[] = [];
      for (const m of marks) if (!at.length || Math.abs(m.x - at[at.length - 1].x) > SAME) at.push(m); else if (m.hole && !at[at.length - 1].hole) at[at.length - 1] = m;
      const holeXs = at.filter(m => m.hole).map(m => r6(m.x));
      const inRun = new Set<number>();
      for (const [i, j] of pitchRuns(holeXs)) {
        const first = at.find(m => m.hole && r6(m.x) === holeXs[i])!, second = at.find(m => m.hole && r6(m.x) === holeXs[i + 1])!;
        list.push({ dim: { ...linear(id, first.ref, second.ref, k), count: j - i }, row: 0, kind: 'pitches', along: k === 0 ? 'u' : 'v', span: [pointOf(first.x, k, pr), pointOf(second.x, k, pr)] });
        for (let t = i + 1; t <= j; t++) inRun.add(holeXs[t]);
      }
      for (const m of at) {
        if (m.hole && inRun.has(r6(m.x))) continue;
        list.push({ dim: linear(id, atMin!.ref, m.ref, k), row: 1 + Math.abs(m.x - pr.min[k]), kind: m.hole ? 'holePositions' : 'levels', along: k === 0 ? 'u' : 'v', span: [atMin!.at, pointOf(m.x, k, pr)] });
      }
    }
    // Callouts: one a kind of hole (concentric outer circles of a counterbore or countersink are in the callout).
    const kinds = new Map<string, Hole[]>();
    for (const h of mine) {
      const inner = mine.find(o => o !== h && sameXY(o.at, h.at) && o.radius < h.radius - SAME && o.callout && /CBORE|CSK/.test(o.callout));
      if (inner) continue;
      const key = (h.callout ?? `Ø${r6(2 * h.radius)}`).replace(/^\d+× /, '');
      kinds.set(key, [...(kinds.get(key) ?? []), h]);
    }
    for (const group of kinds.values()) {
      const h = [...group].sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1])[0];
      list.push({ dim: { view: id, kind: 'diameter', edge: h.edge.name, near: h.ref.near, ...(group.length > 1 ? { count: group.length } : {}), auto: true }, row: 0, kind: 'callouts', along: 'leader', span: [h.at, h.at], radius: h.radius });
    }
    if (mine.length >= 3) {
      // Holes evenly round a point (a bolt circle) are located by their pitch circle: not yet (listed, not guessed).
      const c: XY = [mine.reduce((s, h) => s + h.at[0], 0) / mine.length, mine.reduce((s, h) => s + h.at[1], 0) / mine.length];
      const d = mine.map(h => Math.hypot(h.at[0] - c[0], h.at[1] - c[1]));
      if (d.every(x => Math.abs(x - d[0]) <= 1e-6 * Math.max(1, d[0])) && d[0] > SAME) report.skipped.push({ view: id, what: `${mine.length} holes on a Ø${r6(2 * d[0])} circle`, why: 'a pitch-circle dimension is not available yet: they are located by their positions' });
    }
  }
  // Placement: rows outward from the view on its freer side, inner rows the shorter.
  const out: DrawingDimension[] = [...manual], used = new Set(manual.map(d => d.id));
  const manualSpans = new Set(manual.map(m => spanKey(views, m)).filter((k): k is string => !!k));
  const nextId = () => { let n = 1; while (used.has(`d${n}`)) n++; used.add(`d${n}`); return `d${n}`; };
  for (const id of ORTHO) {
    if (layout.views[id].hidden) continue;
    const pr = views[id], v = layout.views[id], free = room(layout, id), s = v.scale, usedOpposite = { u: 0, v: 0 };
    const uSide: Side = free.above >= free.below ? 'above' : 'below', vSide: Side = free.left >= free.right ? 'left' : 'right';
    const opposite: Record<Side, Side> = { above: 'below', below: 'above', left: 'right', right: 'left' };
    for (const along of ['u', 'v'] as const) {
      // The freer side takes as many rows as fit (the longest, the overall size outermost); the shortest go to the other side.
      const rows = planned[id].filter(p => p.along === along).sort((a, b) => a.row - b.row), side = along === 'u' ? uSide : vSide;
      const fit = Math.max(1, Math.floor((free[side] - FIRST_ROW - TEXT_ROOM) / ROW) + 1), spill = Math.max(0, rows.length - fit);
      const placeAt = (p: Planned, k: number, at: Side) => {
        const off = (FIRST_ROW + ROW * k) / s, mid = (p.span[0][along === 'u' ? 0 : 1] + p.span[1][along === 'u' ? 0 : 1]) / 2;
        const place: XY = along === 'u' ? [mid, at === 'above' ? pr.max[1] + off : pr.min[1] - off] : [at === 'left' ? pr.min[0] - off : pr.max[0] + off, mid];
        add(out, manual, { ...p.dim, place, auto: true } as DrawingDimension, nextId, report, p.kind, manualSpans, views);
      };
      rows.slice(0, spill).forEach((p, k) => placeAt(p, k, opposite[side]));
      rows.slice(spill).forEach((p, k) => placeAt(p, k, side));
      if (along === 'u') usedOpposite.u = spill; else usedOpposite.v = spill;
    }
    // Callouts: leaders out past the view's edge on the side the rows do not use, a row each, sideways away from them.
    const down = uSide === 'above', toRight = vSide === 'left';
    const leaders = planned[id].filter(p => p.along === 'leader');
    // What each side needs: its rows (the spilled ones on the far side), the callouts past them, a view's name below.
    const need: Record<Side, number> = { above: 0, below: 0, left: 0, right: 0 };
    const rowsOn = (n: number) => n ? FIRST_ROW + ROW * (n - 1) + TEXT_ROOM : 0;
    const uRows = planned[id].filter(p => p.along === 'u').length, vRows = planned[id].filter(p => p.along === 'v').length;
    need[uSide] = rowsOn(uRows - usedOpposite.u); need[opposite[uSide]] = Math.max(rowsOn(usedOpposite.u), leaders.length ? CALLOUT_ROW + ROW * (leaders.length - 1 + usedOpposite.u) + TEXT_ROOM : 0);
    need[vSide] = rowsOn(vRows - usedOpposite.v); need[opposite[vSide]] = rowsOn(usedOpposite.v);
    report.needs[id] = { ...need };
    need.below += need.below ? LABEL : 0;
    for (const side of ['above', 'below', 'left', 'right'] as const) if (need[side] > free[side] + 1e-9) report.crowded.push({ view: id, side, neededMM: Math.round(need[side] * 10) / 10, roomMM: Math.round(free[side] * 10) / 10 });
    leaders.sort((a, b) => a.span[0][0] - b.span[0][0]).forEach((p, k) => {
      const [x] = p.span[0], r = p.radius!, off = (CALLOUT_ROW + ROW * (k + usedOpposite.u)) / s;
      const place: XY = [x + (toRight ? 1 : -1) * (r + CALLOUT_RUN / s), down ? pr.min[1] - off : pr.max[1] + off];
      add(out, manual, { ...p.dim, place, auto: true } as DrawingDimension, nextId, report, p.kind, manualSpans, views);
    });
  }
  return { dimensions: out, report };
}

function pointOf(x: number, k: 0 | 1, pr: BrepProjection): XY { return k === 0 ? [x, pr.min[1]] : [pr.min[0], x]; }

function linear(view: ViewId, a: DimPoint, b: DimPoint, k: 0 | 1): Omit<Extract<DrawingDimension, { kind: 'linear' }>, 'id' | 'place'> {
  return { view, kind: 'linear', a, b, orient: k === 0 ? 'horizontal' : 'vertical', auto: true };
}

/** The same measurement as a hand-placed one: same view, kind, orientation and references (by edge and point). */
function sameAs(d: DrawingDimension, m: DrawingDimension): boolean {
  if (d.view !== m.view || d.kind !== m.kind) return false;
  const ref = (p: DimPoint) => `${p.edge}|${p.at}|${p.near.map(r6).join(',')}`;
  if (d.kind === 'linear' && m.kind === 'linear') return d.orient === m.orient && new Set([ref(d.a), ref(d.b)]).size === new Set([ref(d.a), ref(d.b), ref(m.a), ref(m.b)]).size;
  if ((d.kind === 'diameter' || d.kind === 'radius') && (m.kind === 'diameter' || m.kind === 'radius')) return d.edge === m.edge;
  return false;
}

/** A view's axis as the model axis it shows (front and top share X, front and right Z, top and right Y). */
export function axisOf(view: ViewId, k: 0 | 1): string {
  if (view === 'front') return k === 0 ? 'X' : 'Z';
  if (view === 'top') return k === 0 ? 'X' : 'Y';
  if (view === 'right') return k === 0 ? 'Y' : 'Z';
  return `${view}${k}`;
}

/** What a horizontal or vertical dimension measures: the model axis and the two positions along it (null for others). */
function spanKey(views: DrawingViews, d: DrawingDimension): string | null {
  if (d.kind !== 'linear' || d.orient === 'aligned') return null;
  const r = resolveDimension(views, d);
  if (!r.ok || r.kind !== 'linear') return null;
  const k = d.orient === 'horizontal' ? 0 : 1, lo = Math.min(r.a[k], r.b[k]), hi = Math.max(r.a[k], r.b[k]);
  return `${axisOf(d.view, k)}|${r6(lo)}|${r6(hi)}|${d.count ?? 1}`;
}

function add(out: DrawingDimension[], manual: readonly DrawingDimension[], d: DrawingDimension, nextId: () => string, report: AutoDimensionReport, kind: keyof AutoDimensionReport['added'], manualSpans: ReadonlySet<string>, views: DrawingViews): void {
  if (manual.some(m => sameAs(d, m))) return;
  // (One a hand-placed dimension gives already, in this view or one sharing the axis.)
  const key = spanKey(views, d);
  if (key && manualSpans.has(key)) return;
  out.push({ ...d, id: nextId() });
  report.added[kind]++;
}
