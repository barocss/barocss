// Tolerance and GD&T suggestions (R14.4, O5): what the drawing could say about how exact the part must be, each with
// its basis — the data it comes from or, where there is none, that it is an estimate — offered to accept or leave,
// never applied by itself.
//
// Either mode:
//   general note   "UNLESS OTHERWISE STATED: LINEAR ±0.2 · ANGULAR ±0.5°" — an estimate (a common shop default, no standard)
// ± mode (`tolerancing` unset or 'plus-minus'):
//   hole positions ± the value that keeps a hole kind's screws passing, on its location dimensions
// Geometric mode ('geometric'):
//   datums A, B, C  the part's three largest flat sides, square to each other (a prismatic part), on their edges seen edge-on
//   position        a frame under each hole kind's callout: ⌖ Ø T | A | B | C, the hole locations made basic
// The value T for a hole kind comes from the fastener it is for (the studio's sourced ISO 273 clearance data,
// app/fasteners.ts): a clearance hole of diameter H for a screw of diameter F gives T = H − F (each hole floats round
// its screw); a tapped hole gives T = (H − F) / 2 with H the screw's medium clearance hole in the mating part (an
// assumption, said so). A ± tolerance with the same effect on each of two axes is T / (2√2) (the square inside the
// round zone). Values are rounded down to 0.01 mm (tighter, never looser). Holes the data does not place: an estimate.
import { axisOf, holesOf } from './auto';
import { sizeForHole, type FastenerSizes } from '../app/fasteners';
import { datumMarks, projectionOf } from './sheet';
import { fixAll, issueContext, marksClear, type IssueContext, type SheetInputs } from './issues';
import { inView, resolveLine, type Resolved } from './dimensions';
import { samePointDependency } from './measurement';
import { baseViewOf, type DimPoint, type DrawingDatum, type DrawingDimension, type DrawingFrame, type DrawingSettings, type EdgeRef, type ViewId, type XY } from './types';
import { nextFreeId } from '../util/ids';

export const TOLERANCE_SUGGESTIONS_VERSION = 'cad-studio-tolerance-suggestions-v1';

/** The general tolerances suggested: estimates (a common machining default, not from a standard; check the shop's own). */
export const GENERAL_TOLERANCE = { linear: 0.2, angular: 0.5, basis: 'an estimate: a common machining default, not from a standard — check against your shop’s' } as const;
export const GENERAL_NOTE_PREFIX = 'UNLESS OTHERWISE STATED';
/** A hole kind's position tolerance when no fastener data places it: an estimate. */
export const POSITION_ESTIMATE_MM = 0.2;

export type ToleranceSuggestion = {
  id: string;
  kind: 'general-note' | 'hole-plus-minus' | 'datum' | 'position';
  message: string;
  /** Where the value comes from (the data and the relation), or that it is an estimate. */
  basis: string;
  estimate: boolean;
  change: Change;
};
type Change =
  | { kind: 'note'; text: string; at: XY }
  | { kind: 'tolerances'; dims: string[]; value: number }
  | { kind: 'datum'; datum: DrawingDatum }
  | { kind: 'frame'; frame: Extract<DrawingFrame, { dim: string }>; basic: string[] };

const SAME = 1e-6;
const NO_SIZES: FastenerSizes = {};
const floor2 = (v: number) => Math.floor(v * 100 + 1e-9) / 100;

/** The position tolerance of a kind of hole: its value, why, and whether it is an estimate. */
export function holePosition(callout: string | null, diameter: number, sizes: FastenerSizes): { value: number; basis: string; estimate: boolean } {
  const thread = callout?.match(/\bM(\d+(?:\.\d+)?)/);
  if (thread) {
    const size = sizes[`M${thread[1]}`];
    if (size) {
      const H = size.clearance[1], T = floor2((H - size.d) / 2);
      if (T > 0) return { value: T, basis: `a tapped M${thread[1]} hole, its screw fixed: T = (H − F)/2 = (${H} − ${size.d})/2, H the screw's ISO 273 medium clearance hole assumed in the mating part (your fastener sizes)`, estimate: false };
    }
  }
  const s = sizeForHole(diameter, sizes);
  if (s && s.fit.fit === 'clearance') {
    const size = sizes[s.size], F = size.d, T = floor2(diameter - F), series = s.fit.series, H = size.clearance[['fine', 'medium', 'coarse'].indexOf(series)];
    // An ISO 273 hole: the data says which screw. Near one only: the screw is assumed (an estimate, said so).
    if (T > 0 && Math.abs(H - diameter) <= 1e-6) return { value: T, basis: `a Ø${diameter} clearance hole for ${s.size} (ISO 273 ${series}, your fastener sizes), its screw floating: T = H − F = ${diameter} − ${F}`, estimate: false };
    if (T > 0) return { value: T, basis: `an estimate: Ø${diameter} is no ISO 273 hole; ${s.size} assumed (its ${series} hole is Ø${H}), its screw floating: T = H − F = ${diameter} − ${F}`, estimate: true };
  }
  return { value: POSITION_ESTIMATE_MM, basis: 'an estimate: none of your fastener sizes fits this hole', estimate: true };
}

interface HoleKind { dim: Extract<Resolved, { ok: true; kind: 'diameter' | 'radius' }>; callout: string | null; diameter: number; centres: Centre[] }
/** A hole's centre (3D) and its axis. */
/** `ref` and `view` name the hole's own feature (D331); a centre without them (a pitch circle's) is placed by coordinate. */
interface Centre { c: readonly number[]; n: readonly number[]; ref?: DimPoint; view?: ViewId }

/** The drawing's kinds of hole: each diameter dimension on a hole with the holes it stands for (its count, or itself). */
function holeKinds(ctx: IssueContext): HoleKind[] {
  const holes = holesOf(ctx.views, ctx.callout), out: HoleKind[] = [];
  const kindOf = (callout: string | null, r: number) => (callout ?? `Ø${Math.round(2 * r * 1e6) / 1e6}`).replace(/^\d+× /, '');
  for (const r of ctx.sheet.dimensions) {
    if (!r.ok || (r.kind !== 'diameter' && r.kind !== 'radius')) continue;
    const callout = ctx.callout(r.dim.edge), key = kindOf(callout, r.radius);
    const own = holes.find(h => h.view === r.dim.view && Math.abs(h.at[0] - r.center[0]) <= SAME && Math.abs(h.at[1] - r.center[1]) <= SAME && Math.abs(h.radius - r.radius) <= SAME);
    if (!own) continue;
    const members = r.dim.count ? holes.filter(h => Math.abs(h.radius - r.radius) <= SAME && kindOf(h.callout, h.radius) === key) : [own];
    out.push({ dim: r, callout, diameter: Math.round(2 * r.radius * 1e6) / 1e6, centres: members.map(h => ({ c: h.ref.near, n: h.edge.circle!.normal, ref: h.ref, view: h.view })) });
  }
  return out;
}

/**
 * The linear dimensions locating holes (D331): horizontal or vertical ones along an axis square to the holes' that depend
 * on a hole's own feature (its centre, its opposite rim, its combined callout or an authored pattern copy), as the issue
 * check reads them — a dimension that merely ends at the same coordinate does not locate the hole. A counted pitch locates
 * the holes it reaches. (A pitch circle's own centre is still placed by coordinate.)
 */
function locating(ctx: IssueContext, given: readonly Centre[]): string[] {
  const out: string[] = [];
  // (Holes of a pitch circle: the circle itself, and its centre's location, R14.5.)
  const centres: Centre[] = [...given];
  for (const r of ctx.sheet.dimensions) if (r.ok && r.kind === 'pcd' && given.some(({ c }) => { const p = inView(projectionOf(ctx.views, ctx.sheet, r.dim.view)!, c); return r.members.some(m => Math.abs(m[0] - p[0]) <= SAME && Math.abs(m[1] - p[1]) <= SAME); })) { out.push(r.dim.id); centres.push({ c: r.center3, n: given[0].n }); }
  for (const r of ctx.sheet.dimensions) {
    if (!r.ok || r.kind !== 'linear' || r.dim.orient === 'aligned') continue;
    const k = r.dim.orient === 'horizontal' ? 0 : 1, pr = projectionOf(ctx.views, ctx.sheet, r.dim.view)!, step = r.b[k] - r.a[k];
    // (A counted pitch locates the holes it reaches, not the one it starts from.)
    const ends = r.dim.count ? [r.b[k], ...Array.from({ length: r.dim.count - 1 }, (_, j) => r.a[k] + step * (j + 2))] : [r.a[k], r.b[k]];
    // (Along an axis square to the hole's: a position along its own axis is not where the hole is.)
    const axis = k === 0 ? pr.right : pr.up;
    if (centres.some(centre => Math.abs(axis[0] * centre.n[0] + axis[1] * centre.n[1] + axis[2] * centre.n[2]) < 1e-6 && locatesCentre(ctx, r, k, centre, ends))) out.push(r.dim.id);
  }
  return out;
}
/** Whether a linear dimension (along view axis `k`) depends on a hole's own feature; a centre without one: by coordinate. */
function locatesCentre(ctx: IssueContext, r: Extract<Resolved, { ok: true; kind: 'linear' }>, k: 0 | 1, centre: Centre, ends: readonly number[]): boolean {
  const pr = projectionOf(ctx.views, ctx.sheet, r.dim.view)!;
  if (!centre.ref || !centre.view) return ends.some(e => Math.abs(e - inView(pr, centre.c)[k]) <= SAME);
  const target = ctx.views[centre.view], axis = axisOf(baseViewOf(r.dim.view, ctx.sheet.sections ?? [], ctx.sheet.details ?? []), k);
  if (samePointDependency(r.dim.a, pr, centre.ref, target, axis, ctx.locationOwner) || samePointDependency(r.dim.b, pr, centre.ref, target, axis, ctx.locationOwner)) return true;
  if (!r.dim.count || r.dim.a.at !== 'center' || r.dim.b.at !== 'center') return false;
  // (A counted pitch: the holes it reaches past its two ends, on its row or as an authored pattern.)
  const at = inView(target, centre.c), step = r.b[k] - r.a[k];
  const row = Math.abs(r.a[1 - k] - at[1 - k]) <= SAME && Math.abs(r.b[1 - k] - at[1 - k]) <= SAME && r.dim.view === centre.view;
  const pattern = samePointDependency(r.dim.a, pr, centre.ref, target, axis, ctx.locationOwner, true) && samePointDependency(r.dim.b, pr, centre.ref, target, axis, ctx.locationOwner, true);
  if (!row && !pattern) return false;
  for (let j = 2; j <= r.dim.count; j++) if (Math.abs(r.a[k] + step * j - at[k]) <= SAME) return true;
  return false;
}

/** A straight edge of a view lying along one of its extremes (the longest), as a reference. */
function edgeAlong(ctx: IssueContext, view: ViewId, k: 0 | 1, max: boolean): { ref: EdgeRef; line: [XY, XY] } | null {
  const pr = ctx.views[view], at = max ? pr.max[k] : pr.min[k];
  let best: { ref: EdgeRef; line: [XY, XY]; len: number } | null = null;
  for (const e of pr.edges) {
    if (!e.ends || e.circle || !e.pieces.some(p => p.visible)) continue;
    const ref: EdgeRef = { edge: e.name, near: [(e.ends[0][0] + e.ends[1][0]) / 2, (e.ends[0][1] + e.ends[1][1]) / 2, (e.ends[0][2] + e.ends[1][2]) / 2] };
    const line = resolveLine(pr, ref);
    if (!line || Math.abs(line[0][k] - at) > SAME || Math.abs(line[1][k] - at) > SAME) continue;
    const len = Math.hypot(line[1][0] - line[0][0], line[1][1] - line[0][1]);
    if (!best || len > best.len + SAME) best = { ref, line, len };
  }
  return best && { ref: best.ref, line: best.line };
}

/** The datum symbol's place: off its edge, outward, at the first spot clear of the sheet (none: null). */
function datumPlace(ctx: IssueContext, view: ViewId, line: [XY, XY], letter: string, edge: EdgeRef): XY | null {
  const v = ctx.layout.views[view], pr = ctx.views[view], c: XY = [(pr.min[0] + pr.max[0]) / 2, (pr.min[1] + pr.max[1]) / 2];
  const d: XY = [line[1][0] - line[0][0], line[1][1] - line[0][1]], l = Math.hypot(d[0], d[1]);
  let n: XY = [-d[1] / l, d[0] / l];
  const mid: XY = [(line[0][0] + line[1][0]) / 2, (line[0][1] + line[1][1]) / 2];
  if ((mid[0] - c[0]) * n[0] + (mid[1] - c[1]) * n[1] < 0) n = [-n[0], -n[1]];
  // On the edge, then on its extension line past either end (8 mm on the sheet).
  const past = 8 / (l * v.scale);
  for (const off of [9, 14, 19, 24, 29]) for (const t of [0.25, 0.75, 0.5, 0.12, 0.88, 1 + past, -past]) {
    const foot: XY = [line[0][0] + d[0] * t, line[0][1] + d[1] * t], place: XY = [foot[0] + n[0] * off / v.scale, foot[1] + n[1] * off / v.scale];
    const marks = datumMarks(ctx.layout, ctx.views, { id: 'probe', letter, view, edge, place });
    if (marks && marksClear(ctx, marks, view)) return place;
  }
  return null;
}

/** The suggestions for the drawing as it is (those already done or contradicted are left out). */
export function toleranceSuggestions(ctx: IssueContext): ToleranceSuggestion[] {
  const s = ctx.settings, out: ToleranceSuggestion[] = [], geometric = s.tolerancing === 'geometric';
  if (!(s.notes ?? []).some(n => n.text.startsWith(GENERAL_NOTE_PREFIX))) {
    const [x0, y0] = ctx.layout.title, text = `${GENERAL_NOTE_PREFIX}:\nLINEAR ±${GENERAL_TOLERANCE.linear} · ANGULAR ±${GENERAL_TOLERANCE.angular}°`;
    out.push({ id: 'general-note', kind: 'general-note', message: `A general tolerance note: linear ±${GENERAL_TOLERANCE.linear} mm, angular ±${GENERAL_TOLERANCE.angular}° where a dimension says nothing.`, basis: GENERAL_TOLERANCE.basis, estimate: true, change: { kind: 'note', text, at: [x0, y0 - 14] } });
  }
  const kinds = holeKinds(ctx);
  if (!geometric) {
    for (const k of kinds) {
      // Its location dimensions without a tolerance, or with a looser ± one (a dimension shared with other holes gets the
      // tightest); none that is basic (a frame holds its tolerance).
      const p = holePosition(k.callout, k.diameter, ctx.fastenerSizes ?? NO_SIZES), pm = floor2(p.value / (2 * Math.SQRT2)), dims = locating(ctx, k.centres).filter(id => { const d = s.dimensions.find(x => x.id === id)!, t = d.tol; return !d.basic && (!t || (t.kind === 'symmetric' && t.value > pm + 1e-9)); });
      if (!dims.length || pm <= 0) continue;
      out.push({ id: `hole-pm-${k.dim.dim.id}`, kind: 'hole-plus-minus', message: `${k.dim.text}: ±${pm} on ${dims.length} location dimension${dims.length > 1 ? 's' : ''}.`, basis: `${p.basis}; on each axis T/(2√2) = ${p.value}/(2√2)`, estimate: p.estimate, change: { kind: 'tolerances', dims, value: pm } });
    }
    return out;
  }
  // Datums: the largest flat sides square to each other, each where it shows edge-on (bottom and left in the front view, front in the top view).
  const top = ctx.views.top, front = ctx.views.front, right = ctx.views.right;
  const sides = [
    { name: 'bottom', area: (top.max[0] - top.min[0]) * (top.max[1] - top.min[1]), at: edgeAlong(ctx, 'front', 1, false), view: 'front' as const },
    { name: 'front side', area: (front.max[0] - front.min[0]) * (front.max[1] - front.min[1]), at: edgeAlong(ctx, 'top', 1, false), view: 'top' as const },
    { name: 'left side', area: (right.max[0] - right.min[0]) * (right.max[1] - right.min[1]), at: edgeAlong(ctx, 'front', 0, false), view: 'front' as const },
  ].filter(x => x.at).sort((a, b) => b.area - a.area);
  const have = new Set((s.datums ?? []).map(d => d.letter)), letters = ['A', 'B', 'C'], named: string[] = [];
  sides.forEach((side, i) => {
    const letter = letters[i];
    if (have.has(letter)) { named.push(letter); return; }
    const place = datumPlace(ctx, side.view, side.at!.line, letter, side.at!.ref);
    if (!place) return;
    named.push(letter);
    out.push({ id: `datum-${letter}`, kind: 'datum', message: `Datum ${letter}: the ${side.name} (${['primary', 'secondary', 'tertiary'][i]}, the ${['largest', 'next largest', 'third'][i]} flat side).`, basis: 'the part’s largest flat sides, square to each other, in order of area', estimate: false, change: { kind: 'datum', datum: { id: `datum-${letter}`, letter, view: side.view, edge: side.at!.ref, place } } });
  });
  // (A frame names the datums the drawing has or is offered: none it could not place.)
  const datums = letters.filter(l => named.includes(l) || have.has(l));
  const frameIds = new Set((s.frames ?? []).map(f => f.id));
  for (const k of kinds) {
    if ((s.frames ?? []).some(f => f.dim === k.dim.dim.id)) continue;
    const p = holePosition(k.callout, k.diameter, ctx.fastenerSizes ?? NO_SIZES), basic = locating(ctx, k.centres);
    const baseId = `frame-${k.dim.dim.id}`, frameId = frameIds.has(baseId) ? nextFreeId(`${baseId}-`, frameIds, 2) : baseId;
    frameIds.add(frameId);
    out.push({ id: `position-${k.dim.dim.id}`, kind: 'position', message: `${k.dim.text}: position Ø${p.value} to ${datums.join(', ') || 'no datum'}; its ${basic.length} location dimension${basic.length === 1 ? '' : 's'} basic.`, basis: p.basis, estimate: p.estimate,
      change: { kind: 'frame', frame: { id: frameId, dim: k.dim.dim.id, characteristic: 'position', value: p.value, datums }, basic } });
  }
  return out;
}

/** The settings with one suggestion applied. */
export function applySuggestion(settings: DrawingSettings, s: ToleranceSuggestion): DrawingSettings {
  const c = s.change;
  switch (c.kind) {
    case 'note': { const id = nextFreeId('n', new Set((settings.notes ?? []).map(n => n.id))); return { ...settings, notes: [...(settings.notes ?? []), { id, text: c.text, at: c.at }] }; }
    // (Set where there is none, tightened where a looser ± one is: never loosened.)
    case 'tolerances': return { ...settings, dimensions: settings.dimensions.map(d => c.dims.includes(d.id) && (!d.tol || (d.tol.kind === 'symmetric' && d.tol.value > c.value)) ? { ...d, tol: { kind: 'symmetric', value: c.value } } : d) };
    case 'datum': return { ...settings, datums: [...(settings.datums ?? []).filter(d => d.letter !== c.datum.letter), c.datum] };
    case 'frame': {
      const frames = settings.frames ?? [];
      // A suggestion is offered only for a dimension without a frame. Recheck before applying it.
      if (!settings.dimensions.some(d => d.id === c.frame.dim) || frames.some(f => f.dim === c.frame.dim || f.id === c.frame.id)) return settings;
      return {
        ...settings, frames: [...frames, c.frame],
        // (A basic dimension carries no tolerance of its own: the frame holds it.)
        dimensions: settings.dimensions.map(d => { if (!c.basic.includes(d.id)) return d; const { tol: _t, ...rest } = d; void _t; return { ...rest, basic: true } as DrawingDimension; }),
      };
    }
  }
}

/**
 * Every suggestion accepted, one at a time and the drawing looked at again after each (datums before the frames that
 * name them), then the issue list's moves for what overlaps. Returns the settings and what it accepted.
 */
export function acceptAll(i: SheetInputs, max = 30): { settings: DrawingSettings; accepted: ToleranceSuggestion[] } {
  let settings = i.settings; const accepted: ToleranceSuggestion[] = [], done = new Set<string>();
  for (let n = 0; n < max; n++) {
    const list = toleranceSuggestions(issueContext({ ...i, settings })).filter(x => !done.has(x.id));
    const next = list.find(x => x.kind === 'datum') ?? list[0];
    if (!next) break;
    done.add(next.id); accepted.push(next); settings = applySuggestion(settings, next);
  }
  const moved = fixAll({ ...i, settings }, 40, f => f.kind === 'move' || f.kind === 'move-note');
  return { settings: moved.settings, accepted };
}
