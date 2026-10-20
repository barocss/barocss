import type { Point } from './types.js';
import type { ProfileSegmentInput, XY } from './extruded-profile-solid.js';

// R12 sheet metal (D115, D116). A sheet is T thick; a bend is a piece of a cylinder of inner radius R turned θ, its
// neutral layer at R + K·T (K the K-factor, defined by the bend allowance below). These are the closed forms; real K
// values come from a shop's bend tests and are never built in (D115's data rules).

/** The developed length of a bend, θ (radians) at the neutral radius: BA = θ(R + K·T). */
export const bendAllowance = (angle: number, radius: number, thickness: number, kFactor: number): number => angle * (radius + kFactor * thickness);
/** The outside setback, from a bend's tangent line to its outer virtual sharp: OSSB = (R + T)·tan(θ/2) (θ < π). */
export const outsideSetback = (angle: number, radius: number, thickness: number): number => (radius + thickness) * Math.tan(angle / 2);
/** The bend deduction: BD = 2·OSSB − BA (the outside dimensions to the virtual sharps less BD is the flat length). */
export const bendDeduction = (angle: number, radius: number, thickness: number, kFactor: number): number => 2 * outsideSetback(angle, radius, thickness) - bendAllowance(angle, radius, thickness, kFactor);

/** One bend as built: its faces, inner radius, angle, axis and its allowance, setback and deduction. */
export interface SheetBendReport {
  /** `<feature>.bend<k>`, k the path's vertex it rounds. */
  readonly name: string;
  /** Its concave face (radius R) and its convex face (radius R + T). */
  readonly inner: string; readonly outer: string;
  readonly radiusMM: number; readonly angleDegrees: number;
  /** The bend's axis, through its centre along the sheet's width. */
  readonly axis: { readonly origin: Point; readonly direction: Point };
  readonly allowanceMM: number; readonly setbackMM: number; readonly deductionMM: number;
  /** Its K-factor: the sheet's, or its bend table's for its T, R and angle (R12.4), with the rows used. */
  readonly kFactor: number; readonly table?: BendTableUse;
}
/** A sheet-metal body's rules and bends (R12.1, D116). */
export interface SheetReport {
  readonly thicknessMM: number; readonly bendRadiusMM: number;
  /** One K-factor for every bend, or (R12.4, D120) a bend table giving each bend's by its T, R and angle: one of them. */
  readonly kFactor?: number; readonly bendTable?: BendTable;
  /** The face its flat lies in by default (R12.2): a plate's `top`, a profile's `leg0.a`. */
  readonly fixedFace: string;
  readonly bends: readonly SheetBendReport[];
}

/** A sheet-metal refusal: the part model's code, the message starting with its own `[CODE]`. */
export class SheetMetalError extends Error {
  constructor(readonly code: 'PARAMETER' | 'GEOMETRY', detail: string) { super(detail.slice(0, 1024)); this.name = 'SheetMetalError'; }
}

/** A bend of the section: its centre, signed turn (radians, + to the left) and its two faces' names. */
export interface ContourBend { readonly vertex: number; readonly center: XY; readonly angle: number; readonly inner: string; readonly outer: string }
/** A contour flange's section: one closed loop of lines and arcs, a name for each of its segments, its bends. */
export interface ContourSection { readonly segments: readonly ProfileSegmentInput[]; readonly names: readonly string[]; readonly bends: readonly ContourBend[] }

/** Turns within this of 0 or 180° are refused (no bend; a fold back is a hem, not in R12). */
const ANGLE_EPS = 1e-9;
/** A leg's straight part shorter than this is refused: its bends do not fit (R12.1 makes no leg of length 0). */
const MIN_LEG_MM = 1e-6;

/**
 * The section of a contour flange: the open `path` (its corners the reference skin's virtual sharps) is one skin of the
 * sheet, the material T thick to its `side` (left or right, looking along it), a bend at every corner — the radius on
 * the path's skin R where the material lies outside the turn, R + T where it lies inside it, so the inner radius is R
 * either way. Faces: `<id>.leg<i>.a` (on the path) and `.b` (the other skin), `<id>.bend<k>.inner` / `.outer`,
 * `<id>.start` and `<id>.end` (the thickness at the path's ends). Refused by name: a turn of 0 or 180°
 * (`BEND_ANGLE`), a leg too short for its bends (`BEND_DOES_NOT_FIT`), a section crossing or touching itself
 * (`SHEET_CROSSES_ITSELF`).
 */
export function contourFlangeSection(path: readonly XY[], side: 'left' | 'right', thickness: number, radius: number, id: string): ContourSection {
  const n = path.length - 1, s = side === 'left' ? 1 : -1, T = thickness;
  const d: XY[] = [], L: number[] = [];
  for (let i = 0; i < n; i++) {
    const dx = path[i + 1][0] - path[i][0], dy = path[i + 1][1] - path[i][1], l = Math.hypot(dx, dy);
    if (!(l > MIN_LEG_MM)) throw new SheetMetalError('PARAMETER', `[BEND_DOES_NOT_FIT] path points ${i} and ${i + 1} coincide`);
    d.push([dx / l, dy / l]); L.push(l);
  }
  // Each corner k (1 … n − 1): its signed turn θ, the radius on the path's skin, its setback along both legs.
  const turn: number[] = [0], rPath: number[] = [0], back: number[] = [0];
  for (let k = 1; k < n; k++) {
    const a = d[k - 1], b = d[k], th = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
    if (Math.abs(th) < ANGLE_EPS) throw new SheetMetalError('PARAMETER', `[BEND_ANGLE] path point ${k} is in line with its neighbours: no bend there`);
    if (Math.PI - Math.abs(th) < ANGLE_EPS) throw new SheetMetalError('PARAMETER', `[BEND_ANGLE] path point ${k} turns back 180°: a fold back (a hem) is not supported yet`);
    const r = Math.sign(th) === s ? radius + T : radius;
    turn.push(th); rPath.push(r); back.push(r * Math.tan(Math.abs(th) / 2));
  }
  turn.push(0); rPath.push(0); back.push(0);
  // Each leg's straight part on the path's skin, from its start S to its end E.
  const S: XY[] = [], E: XY[] = [], m: XY[] = [];
  for (let i = 0; i < n; i++) {
    const free = L[i] - back[i] - back[i + 1];
    if (!(free > MIN_LEG_MM)) throw new SheetMetalError('PARAMETER', `[BEND_DOES_NOT_FIT] leg ${i} is ${fmt(L[i])} mm between its corners; its bends take ${fmt(back[i] + back[i + 1])} mm of it`);
    S.push([path[i][0] + back[i] * d[i][0], path[i][1] + back[i] * d[i][1]]);
    E.push([path[i + 1][0] - back[i + 1] * d[i][0], path[i + 1][1] - back[i + 1] * d[i][1]]);
    m.push([-s * d[i][1], s * d[i][0]]);
  }
  const segments: ProfileSegmentInput[] = [], names: string[] = [], bends: ContourBend[] = [], centers: XY[] = [[0, 0]];
  for (let k = 1; k < n; k++) {
    const sg = Math.sign(turn[k]);
    centers.push([E[k - 1][0] - sg * rPath[k] * d[k - 1][1], E[k - 1][1] + sg * rPath[k] * d[k - 1][0]]);
    bends.push({ vertex: k, center: centers[k], angle: turn[k], inner: `${id}.bend${k}.inner`, outer: `${id}.bend${k}.outer` });
  }
  for (let i = 0; i < n; i++) {
    segments.push({ kind: 'line', start: S[i] }); names.push(`${id}.leg${i}.a`);
    if (i < n - 1) {
      const k = i + 1, sg = Math.sign(turn[k]);
      // (The material inside the turn: the path's skin is the bend's outer face.)
      segments.push({ kind: 'arc', start: E[i], center: centers[k], direction: sg > 0 ? 'ccw' : 'cw' }); names.push(sg === s ? bends[i].outer : bends[i].inner);
    }
  }
  segments.push({ kind: 'line', start: E[n - 1] }); names.push(`${id}.end`);
  for (let i = n - 1; i >= 0; i--) {
    segments.push({ kind: 'line', start: offset(E[i], m[i], T) }); names.push(`${id}.leg${i}.b`);
    if (i > 0) {
      const sg = Math.sign(turn[i]);
      segments.push({ kind: 'arc', start: offset(S[i], m[i], T), center: centers[i], direction: sg > 0 ? 'cw' : 'ccw' }); names.push(sg === s ? bends[i - 1].inner : bends[i - 1].outer);
    }
  }
  segments.push({ kind: 'line', start: offset(S[0], m[0], T) }); names.push(`${id}.start`);
  const crossing = selfContact(segments);
  if (crossing) throw new SheetMetalError('GEOMETRY', `[SHEET_CROSSES_ITSELF] the sheet's section meets itself: ${names[crossing[0]].slice(id.length + 1)} and ${names[crossing[1]].slice(id.length + 1)} near (${fmt(crossing[2][0])}, ${fmt(crossing[2][1])})`);
  return { segments, names, bends };
}

const fmt = (x: number) => String(+x.toFixed(6));
const offset = (p: XY, m: XY, t: number): XY => [p[0] + t * m[0], p[1] + t * m[1]];

// ---- the section's self-contact test -----------------------------------------------------------------------------------
/** A segment as a line from a to b, or an arc about c of radius r from angle a0 turning `sweep` (signed). */
type Seg = { line: true; a: XY; b: XY } | { line: false; c: XY; r: number; a0: number; sweep: number; a: XY; b: XY };
function segsOf(loop: readonly ProfileSegmentInput[]): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < loop.length; i++) {
    const s = loop[i], b = loop[(i + 1) % loop.length].start;
    if (s.kind === 'line') { out.push({ line: true, a: s.start, b }); continue; }
    const c = s.center, r = Math.hypot(s.start[0] - c[0], s.start[1] - c[1]), a0 = Math.atan2(s.start[1] - c[1], s.start[0] - c[0]), a1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
    let sweep = a1 - a0;
    if (s.direction === 'ccw') { while (sweep <= 0) sweep += 2 * Math.PI; } else { while (sweep >= 0) sweep -= 2 * Math.PI; }
    out.push({ line: false, c, r, a0, sweep, a: s.start, b });
  }
  return out;
}
/** Whether angle t lies on the arc (within `eps` radians of it). */
function onArc(g: Extract<Seg, { line: false }>, t: number, eps: number): boolean {
  let u = (t - g.a0) * Math.sign(g.sweep);
  u = ((u % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return u <= Math.abs(g.sweep) + eps || u >= 2 * Math.PI - eps;
}
/** The points where two segments meet (closed forms: line–line, line–circle, circle–circle), within `tol`. */
function meet(p: Seg, q: Seg, tol: number): XY | null {
  if (p.line && q.line) return lineLine(p, q, tol);
  if (p.line && !q.line) return lineArc(p, q, tol);
  if (!p.line && q.line) return lineArc(q, p, tol);
  return arcArc(p as Extract<Seg, { line: false }>, q as Extract<Seg, { line: false }>, tol);
}
function lineLine(p: Seg, q: Seg, tol: number): XY | null {
  const rx = p.b[0] - p.a[0], ry = p.b[1] - p.a[1], sx = q.b[0] - q.a[0], sy = q.b[1] - q.a[1], den = rx * sy - ry * sx, lp = Math.hypot(rx, ry), lq = Math.hypot(sx, sy);
  const qx = q.a[0] - p.a[0], qy = q.a[1] - p.a[1];
  if (Math.abs(den) <= 1e-12 * lp * lq) {
    // Parallel: they meet only if collinear and overlapping (or touching).
    if (Math.abs(qx * ry - qy * rx) / lp > tol) return null;
    const t0 = (qx * rx + qy * ry) / (lp * lp), t1 = ((q.b[0] - p.a[0]) * rx + (q.b[1] - p.a[1]) * ry) / (lp * lp), lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(1, Math.max(t0, t1));
    return hi >= lo - tol / lp ? [p.a[0] + rx * lo, p.a[1] + ry * lo] : null;
  }
  const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
  return t >= -tol / lp && t <= 1 + tol / lp && u >= -tol / lq && u <= 1 + tol / lq ? [p.a[0] + rx * t, p.a[1] + ry * t] : null;
}
function lineArc(p: Seg, g: Extract<Seg, { line: false }>, tol: number): XY | null {
  const rx = p.b[0] - p.a[0], ry = p.b[1] - p.a[1], l = Math.hypot(rx, ry), ux = rx / l, uy = ry / l, fx = p.a[0] - g.c[0], fy = p.a[1] - g.c[1];
  const along = -(fx * ux + fy * uy), dist2 = (fx + along * ux) ** 2 + (fy + along * uy) ** 2, h2 = g.r * g.r - dist2;
  if (h2 < -2 * g.r * tol) return null;
  const h = Math.sqrt(Math.max(0, h2));
  for (const t of [along - h, along + h]) {
    if (t < -tol || t > l + tol) continue;
    const x = p.a[0] + ux * t, y = p.a[1] + uy * t;
    if (onArc(g, Math.atan2(y - g.c[1], x - g.c[0]), tol / g.r)) return [x, y];
  }
  return null;
}
function arcArc(g: Extract<Seg, { line: false }>, k: Extract<Seg, { line: false }>, tol: number): XY | null {
  const dx = k.c[0] - g.c[0], dy = k.c[1] - g.c[1], D = Math.hypot(dx, dy);
  if (D <= tol) {
    // Concentric: they meet only on one circle, where their angles overlap.
    if (Math.abs(g.r - k.r) > tol) return null;
    for (const t of [k.a0, k.a0 + k.sweep]) if (onArc(g, t, tol / g.r)) return [g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t)];
    for (const t of [g.a0, g.a0 + g.sweep]) if (onArc(k, t, tol / k.r)) return [g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t)];
    return null;
  }
  if (D > g.r + k.r + tol || D < Math.abs(g.r - k.r) - tol) return null;
  const a = (g.r * g.r - k.r * k.r + D * D) / (2 * D), h = Math.sqrt(Math.max(0, g.r * g.r - a * a)), mx = g.c[0] + a * dx / D, my = g.c[1] + a * dy / D;
  for (const sg of [-1, 1]) {
    const x = mx - sg * h * dy / D, y = my + sg * h * dx / D;
    if (onArc(g, Math.atan2(y - g.c[1], x - g.c[0]), tol / g.r) && onArc(k, Math.atan2(y - k.c[1], x - k.c[0]), tol / k.r)) return [x, y];
  }
  return null;
}
/** The first two segments of a closed loop that are not neighbours and meet (or touch), with the point; else null. */
function selfContact(loop: readonly ProfileSegmentInput[]): [number, number, XY] | null {
  const segs = segsOf(loop), N = segs.length;
  let scale = 1;
  for (const s of loop) scale = Math.max(scale, Math.abs(s.start[0]), Math.abs(s.start[1]));
  const tol = 1e-9 * scale;
  for (let i = 0; i < N; i++) for (let j = i + 2; j < N; j++) {
    if (i === 0 && j === N - 1) continue;
    const at = meet(segs[i], segs[j], tol);
    if (at) return [i, j, at];
  }
  return null;
}

/** An edge flange's section in its edge's frame (x out of the plate across the edge, y up from the picked skin). */
export interface FlangeSection { readonly segments: readonly ProfileSegmentInput[]; readonly names: readonly string[]; readonly center: XY }
/**
 * The section of an edge flange (R12.3, D118): the plate at x ≤ 0 between y = −T and the picked skin at y = 0, trimmed
 * back to x = −trim; a bend of inner radius R from there, turning θ up (towards +y), then a straight leg `straight` long.
 * Faces `<id>.root` (where it joins the plate), `.bend.inner` / `.outer`, `.leg.inner` (going on from the picked skin) /
 * `.outer`, `.tip`.
 */
export function flangeSection(id: string, thickness: number, radius: number, angle: number, trim: number, straight: number): FlangeSection {
  const T = thickness, c: XY = [-trim, radius], s = Math.sin(angle), k = Math.cos(angle), d: XY = [k, s];
  const pi: XY = [c[0] + radius * s, c[1] - radius * k], po: XY = [c[0] + (radius + T) * s, c[1] - (radius + T) * k];
  return {
    segments: [
      { kind: 'line', start: [-trim, -T] }, { kind: 'arc', start: [-trim, 0], center: c, direction: 'ccw' }, { kind: 'line', start: pi },
      { kind: 'line', start: [pi[0] + straight * d[0], pi[1] + straight * d[1]] }, { kind: 'line', start: [po[0] + straight * d[0], po[1] + straight * d[1]] },
      { kind: 'arc', start: po, center: c, direction: 'cw' },
    ],
    names: [`${id}.root`, `${id}.bend.inner`, `${id}.leg.inner`, `${id}.tip`, `${id}.leg.outer`, `${id}.bend.outer`],
    center: c,
  };
}

// ---- bend tables (R12.4, D120) ------------------------------------------------------------------------------------------
/** Where a table's values come from: a named source (its page, the date it was read), cited by id from its rows. */
export interface BendTableSource { readonly id: string; readonly label: string; readonly url?: string; readonly read?: string; readonly note?: string }
/**
 * One row: a sheet T thick bent at inner radius R (at `angleDegrees`, or at any angle for a K row without one) has
 * K-factor `kFactor`, or bend allowance `allowanceMM`, or bend deduction `deductionMM` (one of them; the last two need the
 * angle). It cites a `source` by id, or says `estimate: true` — never neither.
 */
export interface BendTableRow {
  readonly thicknessMM: number; readonly radiusMM: number; readonly angleDegrees?: number;
  readonly kFactor?: number; readonly allowanceMM?: number; readonly deductionMM?: number;
  readonly source?: string; readonly estimate?: boolean;
}
/** A bend table carried in the part (R12.4): its rows and the sources they cite. */
export interface BendTable { readonly id: string; readonly material?: string; readonly sources?: readonly BendTableSource[]; readonly rows: readonly BendTableRow[] }
/** How a bend's K came from a table: the rows used (indices), exactly or by linear interpolation, and whether any is an estimate. */
export interface BendTableUse { readonly table: string; readonly rows: readonly number[]; readonly how: 'exact' | 'interpolated'; readonly estimate: boolean }

/** A row's K-factor: given, or from its allowance (K = (BA/θ − R)/T) or its deduction (BA = 2·OSSB − BD). */
export function rowKFactor(row: BendTableRow): number {
  if (row.kFactor !== undefined) return row.kFactor;
  const th = (row.angleDegrees ?? NaN) * Math.PI / 180, T = row.thicknessMM, R = row.radiusMM;
  const ba = row.allowanceMM !== undefined ? row.allowanceMM : 2 * outsideSetback(th, R, T) - row.deductionMM!;
  return (ba / th - R) / T;
}
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Why a bend table is not usable, or null: its shape, its rows' values and citations, no row twice. */
export function bendTableProblem(t: unknown): string | null {
  if (!t || typeof t !== 'object') return 'a bend table is { id, rows, sources? }';
  const b = t as BendTable;
  if (typeof b.id !== 'string' || !b.id) return 'a bend table needs an id';
  if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 1024) return 'a bend table needs 1 to 1024 rows';
  const ids = new Set<string>();
  for (const s of b.sources ?? []) { if (!s || typeof s.id !== 'string' || typeof s.label !== 'string') return 'each source needs an id and a label'; ids.add(s.id); }
  const seen: BendTableRow[] = [];
  for (let i = 0; i < b.rows.length; i++) {
    const r = b.rows[i], at = `row ${i}`;
    if (!r || typeof r !== 'object') return `${at} must be an object`;
    for (const k of ['thicknessMM', 'radiusMM'] as const) if (typeof r[k] !== 'number' || !(r[k] > 0) || !Number.isFinite(r[k])) return `${at}: ${k} must be above 0`;
    if (r.angleDegrees !== undefined && !(typeof r.angleDegrees === 'number' && r.angleDegrees > 0 && r.angleDegrees < 180)) return `${at}: angleDegrees must lie in (0, 180)`;
    const given = (['kFactor', 'allowanceMM', 'deductionMM'] as const).filter(k => r[k] !== undefined);
    if (given.length !== 1 || given.some(k => typeof r[k] !== 'number' || !Number.isFinite(r[k]!))) return `${at}: give one of kFactor, allowanceMM, deductionMM`;
    if (given[0] !== 'kFactor' && r.angleDegrees === undefined) return `${at}: an allowance or a deduction holds at an angle: give angleDegrees`;
    if (r.source === undefined && r.estimate !== true) return `${at}: cite a source, or say estimate: true`;
    if (r.source !== undefined && !ids.has(r.source)) return `${at}: no source ${r.source} in the table`;
    const k = rowKFactor(r);
    if (!(k >= 0 && k <= 1)) return `${at}: its K-factor ${+k.toFixed(6)} lies outside the sheet (0 to 1)`;
    if (seen.some(o => near(o.thicknessMM, r.thicknessMM) && near(o.radiusMM, r.radiusMM) && (o.angleDegrees === undefined ? r.angleDegrees === undefined : r.angleDegrees !== undefined && near(o.angleDegrees, r.angleDegrees)))) return `${at}: T ${r.thicknessMM}, R ${r.radiusMM}${r.angleDegrees !== undefined ? `, ${r.angleDegrees}°` : ''} is given twice`;
    seen.push(r);
  }
  return null;
}

/**
 * A bend's K from a table (D120): the row of its T, R and angle exactly; else linear in R between the rows of its T
 * either side (rows for any angle), or bilinear in R and the angle inside a grid of four rows of its T. Outside the
 * table's rows: a miss, said why.
 */
export function lookupBend(t: BendTable, thickness: number, radius: number, angle: number): { use: BendTableUse; kFactor: number } | { miss: string } {
  const deg = angle * 180 / Math.PI, rows = t.rows.map((r, i) => ({ r, i, k: rowKFactor(r) })).filter(x => near(x.r.thicknessMM, thickness));
  const fmt = (x: number) => String(+x.toFixed(6));
  if (!rows.length) return { miss: `table ${t.id} has no row for ${fmt(thickness)} mm` };
  const est = (xs: { r: BendTableRow }[]) => xs.some(x => x.r.estimate === true);
  const done = (xs: { r: BendTableRow; i: number }[], k: number, how: 'exact' | 'interpolated') => ({ kFactor: k, use: { table: t.id, rows: xs.map(x => x.i), how, estimate: est(xs) } });
  const angled = rows.filter(x => x.r.angleDegrees !== undefined), free = rows.filter(x => x.r.angleDegrees === undefined);
  const exact = angled.find(x => near(x.r.radiusMM, radius) && near(x.r.angleDegrees!, deg)) ?? free.find(x => near(x.r.radiusMM, radius));
  if (exact) return done([exact], exact.k, 'exact');
  // Bilinear in R and the angle over the nearest values either side, all four rows there (fewer where one matches).
  if (angled.length) {
    const rs = [...new Set(angled.map(x => x.r.radiusMM))].sort((a, b) => a - b), as = [...new Set(angled.map(x => x.r.angleDegrees!))].sort((a, b) => a - b);
    const side = (vals: number[], v: number): [number, number] | null => { const e = vals.find(x => near(x, v)); if (e !== undefined) return [e, e]; const lo = vals.filter(x => x < v).pop(), hi = vals.find(x => x > v); return lo !== undefined && hi !== undefined ? [lo, hi] : null; };
    const R2 = side(rs, radius), A2 = side(as, deg);
    if (R2 && A2) {
      const at = (r: number, a: number) => angled.find(x => near(x.r.radiusMM, r) && near(x.r.angleDegrees!, a));
      const c = [at(R2[0], A2[0]), at(R2[1], A2[0]), at(R2[0], A2[1]), at(R2[1], A2[1])];
      if (c.every(Boolean)) {
        const u = R2[1] > R2[0] ? (radius - R2[0]) / (R2[1] - R2[0]) : 0, v = A2[1] > A2[0] ? (deg - A2[0]) / (A2[1] - A2[0]) : 0;
        const k = (1 - u) * (1 - v) * c[0]!.k + u * (1 - v) * c[1]!.k + (1 - u) * v * c[2]!.k + u * v * c[3]!.k;
        return done([...new Map(c.map(x => [x!.i, x!])).values()], k, 'interpolated');
      }
    }
  }
  if (free.length) {
    const lo = free.filter(x => x.r.radiusMM < radius).sort((a, b) => b.r.radiusMM - a.r.radiusMM)[0], hi = free.filter(x => x.r.radiusMM > radius).sort((a, b) => a.r.radiusMM - b.r.radiusMM)[0];
    if (lo && hi) { const u = (radius - lo.r.radiusMM) / (hi.r.radiusMM - lo.r.radiusMM); return done([lo, hi], (1 - u) * lo.k + u * hi.k, 'interpolated'); }
  }
  return { miss: `table ${t.id} has no rows round ${fmt(thickness)} mm, R ${fmt(radius)} mm, ${fmt(deg)}° (an exact row, or rows either side in R${angled.length ? ' and in the angle' : ''})` };
}
