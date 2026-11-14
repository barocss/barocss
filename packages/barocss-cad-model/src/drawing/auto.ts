// Auto-dimension (R14.1, O2): dimensions placed from the part's geometry and its features' intent, as ordinary
// drawing dimensions (persistent edge references; they follow the model and can be moved or removed).
//
// - Overall sizes: width and height in the front view, depth in the top view, between edge ends at the views'
//   extremes.
// - Levels: the distinct positions of the visible straight edges inside a view (steps, notches), baseline from the
//   view's left or bottom extreme: across and along in the top view, heights in the front view.
// - Holes: each hole in the first view it shows round in (top, front, right), located from that view's extremes;
//   three or more in a row (on one line) at one pitch dimensioned as the first and one pitch for all (`3× 20`);
//   three or more of a kind evenly round a point, not a grid (R14.5, O6): their pitch circle (`Ø40 PCD · 6× EQ SP`)
//   and its centre located (a hole there, or the circle's own centre), not each hole.
// - Callouts: one diameter per kind of hole, its text the feature's (THRU, DEEP, thread, counterbore, countersink)
//   and the number of such holes (`4× Ø6.6 THRU`); a counterbore's or countersink's outer circle is in it already.
// Each kind stacks in rows beside its view, on the side with more free room; inner rows the shorter; callouts on the
// other side, a row each.
// What it cannot dimension is listed with the reason, never guessed: a ring's angular position when no hole of it lies on
// a centre line.
import type { BrepProjection } from '@barocss/cad';
import { fmtMM, pitchCircle, resolveDimension, snapPoints, type SnapPoint } from './dimensions';
import type { SheetLayout } from './views';
import { baseViewOf, isSectionRef, type DimPoint, type DimView, type DrawingDimension, type DrawingSettings, type DrawingViews, type SectionRef, type ViewId, type XY } from './types';
import { placementOf, type SheetSection } from './sheet';
import type { PartElement } from './elementCallouts';
import { nextFreeId } from '../util/ids';
import { sameLinearDependency, samePointDependency } from './measurement';
import type { DrawingCallout } from './callout';
import { holeCalloutGroups, holesOf, type Hole } from './holeCircles';
export { holesOf, type Hole } from './holeCircles';

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
  /** O146: the keyseats' and keyways' widths and depths added (apart from `added`, whose shape R14's conformance pins). */
  keys: number;
  /** Dimensions kept because they were placed by hand or carry authored controls. */
  kept: number;
  skipped: { view: ViewId; what: string; why: string }[];
  /** Sides of a view whose rows need more sheet room than there is at this scale and sheet (they overlap what is next to them). */
  crowded: { view: DimView; side: 'above' | 'below' | 'left' | 'right'; needed: number; room: number }[];
  /** The sheet room (mm) each view side's dimensions take, from the view's edge (a view's name below not counted): what the layout gives room for (R14.3). */
  needs: Partial<Record<DimView, Record<'above' | 'below' | 'left' | 'right', number>>>;
}

type Side = 'above' | 'below' | 'left' | 'right';
type Unplaced = Omit<Extract<DrawingDimension, { kind: 'linear' }>, 'id' | 'place'> | Omit<Extract<DrawingDimension, { kind: 'diameter' | 'radius' }>, 'id' | 'place'> | Omit<Extract<DrawingDimension, { kind: 'pcd' }>, 'id' | 'place'>;
interface Planned { dim: Unplaced; row: number; kind: keyof AutoDimensionReport['added'] | 'keys'; along: 'u' | 'v' | 'leader'; span: [XY, XY]; radius?: number }

const r6 = (v: number) => Math.round(v / SAME) * SAME;

// ——— O146 (R12c on drawings, S3b): keyseats and keyways dimensioned — a keyseat's width b and the shaft's d − t1 (from the
// far side of the shaft to the seat's floor), a hub keyway's width and d + t2 (from the far side of the bore to its
// floor). Each is a pair of edge ends found by the faces' names (`<shaft>.keyseat<j>`, its step's silhouette
// `<shaft>.seat<k>~sil`; `<keyway>.keyway`, the bore's face) at exactly the report's distance apart along a view axis — in the
// view where both ends are on visible edges, else the first that has them (dashed). One not found is skipped, said.
interface EndAt { at: XY; ref: DimPoint; visible: boolean; faces: string[] }
// (O148 X2: in a section, the plane's own cut face — `section<k>.cut…` — is left out: an edge of the seat's floor and the cut is the seat's.)
const SECTION_CUT = /^section(\d+|_[A-Za-z0-9_-]+)\.cut(\.|$)/;
const facesOfEdge = (name: string) => name.split('|').map(f => f.replace(/~sil\d*$/, '').replace(/(#\d+)+$/, '')).filter(f => !SECTION_CUT.test(f));
function endsOf(pr: BrepProjection): EndAt[] {
  const out: EndAt[] = [];
  for (const e of pr.edges) if (e.ends) { const faces = facesOfEdge(e.name), visible = e.pieces.some(p => p.visible); for (const p of e.ends) out.push({ at: inViewOf(pr, p), ref: { edge: e.name, at: 'end', near: [p[0], p[1], p[2]] }, visible, faces }); }
  return out;
}
const inViewOf = (pr: BrepProjection, p: readonly number[]): XY => [p[0] * pr.right[0] + p[1] * pr.right[1] + p[2] * pr.right[2], p[0] * pr.up[0] + p[1] * pr.up[1] + p[2] * pr.up[2]];
/** Two ends, one of each set, `want` apart along an axis (and level across it when `level`), the visible ones first. */
function pairApart(as: readonly EndAt[], bs: readonly EndAt[], want: number, level: boolean): { a: EndAt; b: EndAt; k: 0 | 1 } | null {
  let best: { a: EndAt; b: EndAt; k: 0 | 1; score: number } | null = null;
  for (const k of [0, 1] as const) for (const a of as) for (const b of bs) {
    if (Math.abs(Math.abs(a.at[k] - b.at[k]) - want) > 1e-6 * Math.max(1, want)) continue;
    if (level && Math.abs(a.at[1 - k] - b.at[1 - k]) > SAME) continue;
    const score = Number(a.visible) + Number(b.visible);
    if (!best || score > best.score) best = { a, b, k, score };
  }
  return best && { a: best.a, b: best.b, k: best.k };
}
function keyPlans(views: DrawingViews, layout: SheetLayout, elements: readonly PartElement[], report: AutoDimensionReport, sections: readonly SheetSection[] = []): Planned[] {
  const want: { what: string; a: (f: string[]) => boolean; b: (f: string[]) => boolean; mm: number; level: boolean }[] = [];
  for (const { id, element: e } of elements) {
    if (e.kind === 'shaft') for (const s of e.report.keyseats) {
      const seat = `${id}.keyseat${s.index}`, step = e.report.steps[s.step - 1], d = step ? step.diameter : NaN;
      want.push({ what: `keyseat ${s.index}'s width`, a: f => f.includes(seat), b: f => f.includes(seat), mm: s.width, level: true });
      // (Its floor: an edge between two of the seat's own faces; the far side: its step's silhouette.)
      if (Number.isFinite(d)) want.push({ what: `d − t1 at keyseat ${s.index}`, a: f => f.length > 0 && f.every(x => x === seat), b: f => f.some(x => x === `${id}.seat${s.step}` || x.startsWith(`${id}.seat${s.step}.`)), mm: d - s.depth, level: false });
    }
    if (e.kind === 'keyway') {
      const way = `${id}.keyway`, bore = e.report.face;
      want.push({ what: `keyway ${id}'s width`, a: f => f.includes(way), b: f => f.includes(way), mm: e.report.width, level: true });
      want.push({ what: `d + t2 at keyway ${id}`, a: f => f.includes(way) && !f.includes(bore), b: f => f.includes(bore) && !f.includes(way), mm: 2 * e.report.boreRadius + e.report.depth, level: false });
    }
  }
  const out: Planned[] = [];
  // (O148 X2: the sections the layout placed too, after the views: one moves there only where it shows more ends visible.)
  const where: [DimView, BrepProjection][] = [...ORTHO.filter(v => !layout.views[v].hidden).map(v => [v, views[v]] as [DimView, BrepProjection]),
    ...sections.filter(x => layout.sections?.some(p => p.section === x.id)).map(x => [`section:${x.id}` as SectionRef, x.projection] as [DimView, BrepProjection])];
  for (const w of want) {
    let found: { view: DimView; a: EndAt; b: EndAt; k: 0 | 1; visible: number } | null = null;
    for (const [v, pr] of where) {
      const ends = endsOf(pr), p = pairApart(ends.filter(x => w.a(x.faces)), ends.filter(x => w.b(x.faces)), w.mm, w.level);
      if (p && (!found || Number(p.a.visible) + Number(p.b.visible) > found.visible)) found = { view: v, ...p, visible: Number(p.a.visible) + Number(p.b.visible) };
    }
    if (!found) { report.skipped.push({ view: 'front', what: w.what, why: 'no two edge ends at that distance in a shown view' }); continue; }
    const [a, b] = found.a.at[found.k] <= found.b.at[found.k] ? [found.a, found.b] : [found.b, found.a];
    out.push({ dim: linear(found.view, a.ref, b.ref, found.k), row: 0.5, kind: 'keys', along: found.k === 0 ? 'u' : 'v', span: [a.at, b.at] });
  }
  return out;
}

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
function room(layout: SheetLayout, id: DimView): Record<Side, number> {
  const own = placementOf(layout, undefined, id)!, [x0, y0, x1, y1] = own.box, f = layout.frame;
  const others = [...ORTHO.filter(o => o !== id), 'iso' as const].filter(o => !layout.views[o].hidden).map(o => layout.views[o].box).concat((layout.sections ?? []).filter(x => x !== own).map(x => x.box), [layout.title]);
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

/** Holes of one kind evenly round a point, three or more and not a grid: a ring, with its centre (a point, or the hole on it). */
interface Ring { members: Hole[]; at: XY; radius: number; centre: DimPoint | null }
function ringsOf(pr: BrepProjection, holes: readonly Hole[]): Ring[] {
  const kinds = new Map<string, Hole[]>();
  for (const h of holes) { const key = `${(h.callout ?? '').replace(/^\d+× /, '')}|${r6(h.radius)}`; kinds.set(key, [...(kinds.get(key) ?? []), h]); }
  const out: Ring[] = [];
  for (const group of kinds.values()) {
    if (group.length < 3) continue;
    // A grid (every hole lined up with another both ways: a rectangle's corners) is dimensioned by its positions.
    const lined = (h: Hole, k: 0 | 1) => group.some(o => o !== h && Math.abs(o.at[k] - h.at[k]) <= SAME);
    if (group.every(h => lined(h, 0) && lined(h, 1))) continue;
    const ring = group.map(h => ({ edge: h.ref.edge, near: h.ref.near })), c = pitchCircle(pr, ring);
    if (!c || !c.even) continue;
    const at: XY = [dot3(c.center, pr.right), dot3(c.center, pr.up)];
    // A hole on its centre locates it; else the circle's own centre does.
    const onCentre = holes.some(h => !group.includes(h) && Math.abs(h.at[0] - at[0]) <= SAME && Math.abs(h.at[1] - at[1]) <= SAME);
    out.push({ members: group, at, radius: c.radius, centre: onCentre ? null : { edge: ring[0].edge, at: 'pcd', near: ring[0].near, ring } });
  }
  return out;
}
const dot3 = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Positions inside a view along one axis: edge levels and hole centres, each with a reference point. */
export interface Mark { x: number; ref: DimPoint; hole: boolean }

/** Straight visible edges across `k` (constant along it): their position and an end to measure from. */
/**
 * A frame member's bore (a tube's inside, `n<frame>.m<member>.bore…`): its wall is its section's, said in the cut list and
 * the section's callout, so its edges are no levels to dimension a weldment by (O171, F8) — they crowded A9's frame drawing
 * with a 3 and a 37 at every member end.
 */
const FRAME_BORE = /(?:^|\|)n\d+\.m\d+\.bore\b/;
export function levels(pr: BrepProjection, k: 0 | 1): Mark[] {
  const out: Mark[] = [];
  for (const e of pr.edges) {
    if (!e.ends || e.circle || (e.kind !== 'line' && e.kind !== 'silhouette') || !e.pieces.some(p => p.visible) || FRAME_BORE.test(e.name)) continue;
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

/** Keep the existing annotation and its source references when it carries an authored control. */
export function retainedDimensions(settings: DrawingSettings): DrawingDimension[] {
  const attached = new Set(settings.frames?.map(frame => frame.dim));
  return settings.dimensions.filter(d => !d.auto || d.tol !== undefined || d.basic || attached.has(d.id));
}

/**
 * The dimensions Auto-dimension gives the part's views, with retained annotations kept and unedited auto dimensions
 * replaced. `callout`: a hole's callout by an edge of it (null: not a hole feature).
 */
export function autoDimensions(views: DrawingViews, layout: SheetLayout, settings: DrawingSettings, callout: DrawingCallout, elements: readonly PartElement[] = [], sections: readonly SheetSection[] = [], locationOwner?: (edge: string) => string | null): { dimensions: DrawingDimension[]; report: AutoDimensionReport } {
  const retained = retainedDimensions(settings);
  const report: AutoDimensionReport = { contract: AUTO_DIMENSIONS_VERSION, added: { overall: 0, levels: 0, holePositions: 0, pitches: 0, callouts: 0 }, keys: 0, kept: retained.length, skipped: [], crowded: [], needs: {} };
  const holes = holesOf(views, callout, locationOwner), planned: Partial<Record<DimView, Planned[]>> & Record<ViewId, Planned[]> = { front: [], top: [], right: [], iso: [] };
  // (O146: the keyseats' and the keyways' sizes, each in the view — or, O148 X2, the section — that shows it best.)
  for (const p of keyPlans(views, layout, elements, report, sections)) (planned[p.dim.view] ??= []).push(p);
  // (A section's dimensions are read from its projection, as a view's are from the view's.)
  const dimViews: Partial<Record<DimView, BrepProjection>> = { ...views, ...Object.fromEntries(sections.map(x => [`section:${x.id}`, x.projection])) };
  const base = (v: DimView): ViewId => baseViewOf(v, sections, settings.details);
  for (const id of ORTHO) {
    // (A view not shown (R14.3) gets nothing; a hole that shows round only there is the issue list's VIEW_NEEDED.)
    if (layout.views[id].hidden) continue;
    const pr = views[id], snaps = snapPoints(pr), list = planned[id];
    const lo = [extreme(snaps, 0, false), extreme(snaps, 1, false)] as const, hi = [extreme(snaps, 0, true), extreme(snaps, 1, true)] as const;
    const all = holes.filter(h => h.view === id), rings = ringsOf(pr, all);
    // (A ring's holes are located by its centre and its pitch circle, not one by one; a hole on its centre as usual.)
    const inRing = new Set(rings.flatMap(r => r.members)), mine = all.filter(h => !inRing.has(h));
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
      if (!okMin || (!wantLevels && !mine.length && !rings.length)) { if (mine.length && !okMin) report.skipped.push({ view: id, what: `${mine.length} hole position${mine.length > 1 ? 's' : ''} ${k === 0 ? 'across' : 'up'}`, why: 'no edge end at the view’s extreme to measure from' }); continue; }
      const marks: Mark[] = [...(wantLevels ? levels(pr, k) : []), ...mine.map(h => ({ x: h.at[k], ref: h.ref, hole: true })), ...rings.filter(r => r.centre).map(r => ({ x: r.at[k], ref: r.centre!, hole: true }))]
        .filter(m => m.x > pr.min[k] + SAME && m.x < pr.max[k] - SAME);
      // Keep each independent centre target, even when coordinates match. A hole's centre takes precedence over an edge level.
      marks.sort((a, b) => a.x - b.x || Number(b.hole) - Number(a.hole));
      const at: Mark[] = [];
      for (const m of marks) {
        let same = -1;
        for (let i = 0; i < at.length; i++) {
          const previous = at[i];
          if (Math.abs(m.x - previous.x) <= SAME && (!m.hole || !previous.hole || samePointDependency(m.ref, pr, previous.ref, pr, axisOf(id, k), locationOwner))) { same = i; break; }
        }
        if (same < 0) at.push(m); else if (m.hole && !at[same].hole) at[same] = m;
      }
      // Rows: holes on one line across this axis (the same position along the other). Three or more at one pitch in a
      // row: its first located, then one explicit counted pitch for that row.
      const rows = new Map<number, Hole[]>();
      for (const h of mine) if (h.at[k] > pr.min[k] + SAME && h.at[k] < pr.max[k] - SAME) { const key = r6(h.at[1 - k]), row = rows.get(key); if (row) row.push(h); else rows.set(key, [h]); }
      const inRun = new Set<DimPoint>();
      for (const row of [...rows.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1])) {
        const line = row.sort((a, b) => a.at[k] - b.at[k]).filter((h, i, all) => !i || h.at[k] - all[i - 1].at[k] > SAME), xs = line.map(h => r6(h.at[k]));
        for (const [i, j] of pitchRuns(xs)) {
          list.push({ dim: { ...linear(id, line[i].ref, line[i + 1].ref, k), count: j - i }, row: 0, kind: 'pitches', along: k === 0 ? 'u' : 'v', span: [pointOf(line[i].at[k], k, pr), pointOf(line[i + 1].at[k], k, pr)] });
          for (let t = i + 1; t <= j; t++) inRun.add(line[t].ref);
        }
      }
      for (const m of at) {
        if (m.hole && inRun.has(m.ref)) continue;
        // A run's first hole and every independent target outside a run keep their own baseline.
        list.push({ dim: linear(id, atMin!.ref, m.ref, k), row: 1 + Math.abs(m.x - pr.min[k]), kind: m.hole ? 'holePositions' : 'levels', along: k === 0 ? 'u' : 'v', span: [atMin!.at, pointOf(m.x, k, pr)] });
      }
    }
    // Callouts: one a kind of hole (concentric outer circles of a counterbore or countersink are in the callout).
    for (const group of holeCalloutGroups(all, locationOwner, callout.holeKind).values()) {
      const h = [...group].sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1])[0];
      list.push({ dim: { view: id, kind: 'diameter', edge: h.edge.name, near: h.ref.near, ...(group.length > 1 ? { count: group.length } : {}), auto: true }, row: 0, kind: 'callouts', along: 'leader', span: [h.at, h.at], radius: h.radius });
    }
    for (const r of rings) {
      // The pitch circle, its leader placed like a callout's.
      list.push({ dim: { view: id, kind: 'pcd', ring: r.members.map(h => ({ edge: h.ref.edge, near: h.ref.near })), auto: true }, row: 0, kind: 'callouts', along: 'leader', span: [r.at, r.at], radius: r.radius });
      // Its angular position needs a hole on a centre line through it (an angle to the first is not placed yet).
      if (!r.members.some(h => Math.abs(h.at[0] - r.at[0]) <= SAME || Math.abs(h.at[1] - r.at[1]) <= SAME)) report.skipped.push({ view: id, what: `the angular position of the ${r.members.length} holes on a Ø${fmtMM(2 * r.radius)} circle`, why: 'no hole lies on a centre line through it: an angle to the first hole is not placed yet' });
    }
  }
  // Placement: rows outward from the view on its freer side, inner rows the shorter.
  const out: DrawingDimension[] = [...retained], used = new Set([...(settings.sheetContext?.dimensionIdsOnOtherSheets ?? []), ...retained.map(d => d.id)]);
  const retainedSpans = new Map<string, DrawingDimension[]>();
  for (const m of retained) { const key = spanKey(dimViews, m, base); if (key) { const bucket = retainedSpans.get(key) ?? []; bucket.push(m); retainedSpans.set(key, bucket); } }
  const nextId = () => { const id = nextFreeId('d', used); used.add(id); return id; };
  const onSections = sections.filter(x => layout.sections?.some(p => p.section === x.id)).map(x => `section:${x.id}` as SectionRef);
  for (const id of [...ORTHO.filter(o => !layout.views[o].hidden), ...onSections] as DimView[]) {
    if (!planned[id]?.length && isSectionRef(id)) continue;
    const pr = dimViews[id]!, v = placementOf(layout, undefined, id)!, free = room(layout, id), s = v.scale, usedOpposite = { u: 0, v: 0 };
    const uSide: Side = free.above >= free.below ? 'above' : 'below', vSide: Side = free.left >= free.right ? 'left' : 'right';
    const opposite: Record<Side, Side> = { above: 'below', below: 'above', left: 'right', right: 'left' };
    for (const along of ['u', 'v'] as const) {
      // The freer side takes as many rows as fit (the longest, the overall size outermost); the shortest go to the other side.
      const rows = planned[id]!.filter(p => p.along === along).sort((a, b) => a.row - b.row), side = along === 'u' ? uSide : vSide;
      const fit = Math.max(1, Math.floor((free[side] - FIRST_ROW - TEXT_ROOM) / ROW) + 1), spill = Math.max(0, rows.length - fit);
      const placeAt = (p: Planned, k: number, at: Side) => {
        const off = (FIRST_ROW + ROW * k) / s, mid = (p.span[0][along === 'u' ? 0 : 1] + p.span[1][along === 'u' ? 0 : 1]) / 2;
        const place: XY = along === 'u' ? [mid, at === 'above' ? pr.max[1] + off : pr.min[1] - off] : [at === 'left' ? pr.min[0] - off : pr.max[0] + off, mid];
        add(out, retained, { ...p.dim, place, auto: true } as DrawingDimension, nextId, report, p.kind, retainedSpans, dimViews, base, locationOwner);
      };
      rows.slice(0, spill).forEach((p, k) => placeAt(p, k, opposite[side]));
      rows.slice(spill).forEach((p, k) => placeAt(p, k, side));
      if (along === 'u') usedOpposite.u = spill; else usedOpposite.v = spill;
    }
    // Callouts: leaders out past the view's edge on the side the rows do not use, a row each, sideways away from them.
    const down = uSide === 'above', toRight = vSide === 'left';
    const leaders = planned[id]!.filter(p => p.along === 'leader');
    // What each side needs: its rows (the spilled ones on the far side), the callouts past them, a view's name below.
    const need: Record<Side, number> = { above: 0, below: 0, left: 0, right: 0 };
    const rowsOn = (n: number) => n ? FIRST_ROW + ROW * (n - 1) + TEXT_ROOM : 0;
    const uRows = planned[id]!.filter(p => p.along === 'u').length, vRows = planned[id]!.filter(p => p.along === 'v').length;
    need[uSide] = rowsOn(uRows - usedOpposite.u); need[opposite[uSide]] = Math.max(rowsOn(usedOpposite.u), leaders.length ? CALLOUT_ROW + ROW * (leaders.length - 1 + usedOpposite.u) + TEXT_ROOM : 0);
    need[vSide] = rowsOn(vRows - usedOpposite.v); need[opposite[vSide]] = rowsOn(usedOpposite.v);
    report.needs[id] = { ...need };
    need.below += need.below ? LABEL : 0;
    for (const side of ['above', 'below', 'left', 'right'] as const) if (need[side] > free[side] + 1e-9) report.crowded.push({ view: id, side, needed: Math.round(need[side] * 10) / 10, room: Math.round(free[side] * 10) / 10 });
    leaders.sort((a, b) => a.span[0][0] - b.span[0][0]).forEach((p, k) => {
      const [x] = p.span[0], r = p.radius!, off = (CALLOUT_ROW + ROW * (k + usedOpposite.u)) / s;
      const place: XY = [x + (toRight ? 1 : -1) * (r + CALLOUT_RUN / s), down ? pr.min[1] - off : pr.max[1] + off];
      add(out, retained, { ...p.dim, place, auto: true } as DrawingDimension, nextId, report, p.kind, retainedSpans, dimViews, base, locationOwner);
    });
  }
  return { dimensions: out, report };
}

function pointOf(x: number, k: 0 | 1, pr: BrepProjection): XY { return k === 0 ? [x, pr.min[1]] : [pr.min[0], x]; }

function linear(view: DimView, a: DimPoint, b: DimPoint, k: 0 | 1): Omit<Extract<DrawingDimension, { kind: 'linear' }>, 'id' | 'place'> {
  return { view, kind: 'linear', a, b, orient: k === 0 ? 'horizontal' : 'vertical', auto: true };
}

const edgeKey = (p: { edge: string; near: readonly number[] }) => JSON.stringify([p.edge, p.near.map(r6)]);
const ringKey = (ring: readonly { edge: string; near: readonly number[] }[]) => JSON.stringify(ring.map(edgeKey).sort());

/** The same measurement as a retained one: same view, kind, orientation and source references. */
function sameAs(d: DrawingDimension, m: DrawingDimension): boolean {
  if (d.view !== m.view || d.kind !== m.kind) return false;
  const ref = (p: DimPoint) => p.at === 'pcd' ? ringKey(p.ring ?? []) : `${p.at}|${edgeKey(p)}`;
  if (d.kind === 'linear' && m.kind === 'linear') {
    if (d.orient !== m.orient || (d.count ?? 1) !== (m.count ?? 1)) return false;
    return (ref(d.a) === ref(m.a) && ref(d.b) === ref(m.b)) || (!d.count && !m.count && ref(d.a) === ref(m.b) && ref(d.b) === ref(m.a));
  }
  if (d.kind === 'pcd' && m.kind === 'pcd') return ringKey(d.ring) === ringKey(m.ring);
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
function spanKey(views: Partial<Record<DimView, BrepProjection>>, d: DrawingDimension, base: (v: DimView) => ViewId): string | null {
  if (d.kind !== 'linear' || d.orient === 'aligned') return null;
  const r = resolveDimension(views, d);
  if (!r.ok || r.kind !== 'linear') return null;
  const k = d.orient === 'horizontal' ? 0 : 1, lo = Math.min(r.a[k], r.b[k]), hi = Math.max(r.a[k], r.b[k]);
  return `${axisOf(base(d.view), k)}|${r6(lo)}|${r6(hi)}|${d.count ?? 1}`;
}

function add(out: DrawingDimension[], retained: readonly DrawingDimension[], d: DrawingDimension, nextId: () => string, report: AutoDimensionReport, kind: keyof AutoDimensionReport['added'] | 'keys', retainedSpans: ReadonlyMap<string, readonly DrawingDimension[]>, views: Partial<Record<DimView, BrepProjection>>, base: (v: DimView) => ViewId, locationOwner?: (edge: string) => string | null): void {
  if (retained.some(m => sameAs(d, m))) return;
  // A retained dimension may already give the measurement in this view or one sharing the axis.
  const key = spanKey(views, d, base);
  if (key) {
    const resolved = resolveDimension(views, d), projection = views[d.view];
    if (resolved.ok && resolved.kind === 'linear' && projection) for (const m of retainedSpans.get(key) ?? []) {
      const other = resolveDimension(views, m), otherProjection = views[m.view];
      if (other.ok && other.kind === 'linear' && otherProjection && sameLinearDependency(resolved, projection, other, otherProjection, axisOf(base(d.view), resolved.dim.orient === 'horizontal' ? 0 : 1), locationOwner)) return;
    }
  }
  out.push({ ...d, id: nextId() });
  if (kind === 'keys') report.keys++; else report.added[kind]++;
}
