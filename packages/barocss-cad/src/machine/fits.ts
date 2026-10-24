// R12c.2 (D155): fits and tolerances from the user's tables.
//
// No limits are built in and none is computed: ISO 286's tolerance factor reproduces only 55 of 91 IT values (D139
// S0), so a size's limits are a row the user loads — `{ class, overMM, upToMM, upperUM, lowerUM }`, each citing a source
// in its table or flagged `estimate`, as the bend tables (D120). A class with no row for a size is a typed miss that
// says what to load.
// - `fitTableProblem`: a table's validity ([FIT_TABLE]): the class's form (a hole's capital letters, a shaft's small
//   ones, then its grade), each range over < up to and no two ranges of one class overlapping, upper ≥ lower, a
//   source the table holds or the estimate flag (not both, never neither).
// - `lookupFit`: a class's row at a nominal size, over < size ≤ up to (the first range from 0 includes its top),
//   across the tables in order ([FIT_TABLE_MISS]); the size judged to 1e-6 mm, as its messages name it (D266).
// - `fitLimits`: a hole class and a shaft class at one nominal size — both limits, the least and the greatest
//   clearance (ES − ei, EI − es) and the kind: clearance (least ≥ 0), interference (greatest ≤ 0), else transition.
// - `checkFit`: a hole face and a shaft face of two B-reps — cylinders, of one nominal size, on parallel axes — their
//   limits, the axes' offset and the faces' overlap along them; then the pair at its maximum and least material
//   conditions (the hole at its least or greatest size, the shaft at its greatest or least) built on the faces' own
//   axes over that overlap and intersected by the analytic Boolean (D139 S0's construction). A clearance fit whose
//   bodies overlap at MMC — the shaft off the hole's axis by more than the clearance — is contradicted by the geometry:
//   an error (FIT_PAIR), with the overlap.
import type { Brep } from '../brep/brep-core.js';
import { booleanAnalytic, faceGeometry } from '../brep/analytic-boolean.js';
import { brepMassProperties } from '../brep/solid-mass.js';
import { evaluateCadPart } from '../part/part-model.js';
import type { Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';

export type FitErrorCode = 'FIT_TABLE' | 'FIT_TABLE_MISS' | 'FIT_FACE' | 'FIT_PAIR';
export class FitError extends KernelError {
  constructor(readonly code: FitErrorCode, detail: string) { super(`[${code}] ${detail}`); this.name = 'FitError'; }
}
export interface FitSource { readonly id: string; readonly label: string; readonly url?: string; readonly read?: string; readonly note?: string }
/** A class's limits over a range of nominal sizes: over < size ≤ up to (mm), the upper and lower deviations (µm). */
export interface FitRow { readonly class: string; readonly overMM: number; readonly upToMM: number; readonly upperUM: number; readonly lowerUM: number; readonly source?: string; readonly estimate?: boolean }
export interface FitTable { readonly id: string; readonly sources?: readonly FitSource[]; readonly rows: readonly FitRow[] }

/** ISO 286's fundamental-deviation letters (a hole's capitals; a shaft's the same in small letters) and IT grades 01, 0–18. */
const CLASS = /^(A|B|C|CD|D|E|EF|F|FG|G|H|JS|J|K|M|N|P|R|S|T|U|V|X|Y|Z|ZA|ZB|ZC|a|b|c|cd|d|e|ef|f|fg|g|h|js|j|k|m|n|p|r|s|t|u|v|x|y|z|za|zb|zc)(01|0|1[0-8]|[1-9])$/;
/** Whether a class is a hole's (capital letters). */
export const isHoleClass = (c: string): boolean => /^[A-Z]/.test(c);
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Why a fit table is not one, or null. */
export function fitTableProblem(t: unknown): string | null {
  if (!isObj(t)) return 'a fit table is an object { id, sources?, rows }';
  if (typeof t.id !== 'string' || !t.id.trim()) return 'a fit table needs an id';
  const sources = t.sources ?? [];
  if (!Array.isArray(sources) || !sources.every(s => isObj(s) && typeof s.id === 'string' && typeof s.label === 'string')) return `${t.id}: sources are [{ id, label, url?, read?, note? }]`;
  const ids = new Set(sources.map(s => (s as FitSource).id));
  if (ids.size !== sources.length) return `${t.id}: two sources share an id`;
  if (!Array.isArray(t.rows) || !t.rows.length) return `${t.id}: rows must be a list of at least one row`;
  const byClass = new Map<string, [number, number, number][]>();
  for (const [k, r] of t.rows.entries()) {
    const at = `${t.id} row ${k}`;
    if (!isObj(r)) return `${at} is not an object`;
    for (const key of Object.keys(r)) if (!['class', 'overMM', 'upToMM', 'upperUM', 'lowerUM', 'source', 'estimate'].includes(key)) return `${at}: unknown field ${key}`;
    if (typeof r.class !== 'string' || !CLASS.test(r.class)) return `${at}: class ${JSON.stringify(r.class)} is not a tolerance class (a deviation letter, capital for a hole, small for a shaft, then an IT grade: H7, g6, JS9)`;
    if (!fin(r.overMM) || !fin(r.upToMM) || r.overMM < 0 || !(r.overMM < r.upToMM)) return `${at} (${r.class}): its range must be over ≥ 0 and below up to (mm)`;
    if (!fin(r.upperUM) || !fin(r.lowerUM) || r.upperUM < r.lowerUM) return `${at} (${r.class}): its upper deviation must be at or above its lower (µm)`;
    const src = r.source !== undefined, est = r.estimate === true;
    if (r.estimate !== undefined && typeof r.estimate !== 'boolean') return `${at}: estimate is true or left out`;
    if (src === est) return `${at} (${r.class}): cite one of the table's sources, or say estimate: true — ${src ? 'not both' : 'never neither'}`;
    if (src && (typeof r.source !== 'string' || !ids.has(r.source))) return `${at} (${r.class}): source ${JSON.stringify(r.source)} is not among the table's sources`;
    const list = byClass.get(r.class) ?? []; list.push([r.overMM, r.upToMM, k]); byClass.set(r.class, list);
  }
  for (const [c, list] of byClass) {
    const s = [...list].sort((x, y) => x[0] - y[0]);
    for (let i = 1; i < s.length; i++) if (s[i][0] < s[i - 1][1]) return `${t.id}: ${c}'s ranges over ${s[i - 1][0]} up to ${s[i - 1][1]} (row ${s[i - 1][2]}) and over ${s[i][0]} up to ${s[i][1]} (row ${s[i][2]}) overlap`;
  }
  return null;
}

/** A class's limits at a nominal size: the deviations, the limit sizes and the row they come from. */
export interface FitLimit {
  readonly class: string; readonly nominalMM: number; readonly upperUM: number; readonly lowerUM: number;
  /** The greatest and least sizes: nominal + upper, nominal + lower. */
  readonly maxMM: number; readonly minMM: number;
  readonly table: string; readonly row: number; readonly estimate: boolean; readonly source?: string;
}
/**
 * A nominal size as it is judged and named: to 1e-6 mm, the resolution its messages print (D266). A size measured off a
 * face carries the arc's rounding — a Ø50 bore's radius comes back 25.000000000000007 — and a range's end decides the row
 * on it: unsnapped, "up to 50" missed a Ø50 bore by a few ulps. Ten of the kernel's linear tolerances (1e-7 mm), so two
 * sizes it snaps together are one size in the model; round(x·10⁶)/10⁶ is the double nearest the decimal typed.
 */
const nominalOf = (mm: number): number => Math.round(mm * 1e6) / 1e6;
/** A class's row at a nominal size, from the first table holding one ([FIT_TABLE_MISS] says what to load). */
export function lookupFit(tables: readonly FitTable[], cls: string, sizeMM: number): FitLimit {
  if (!CLASS.test(cls)) throw new FitError('FIT_TABLE', `${JSON.stringify(cls)} is not a tolerance class`);
  const nominalMM = fin(sizeMM) ? nominalOf(sizeMM) : sizeMM;
  if (!(fin(nominalMM) && nominalMM > 0)) throw new FitError('FIT_FACE', `a nominal size must be above 0 mm (got ${sizeMM})`);
  for (const t of tables) {
    const k = t.rows.findIndex(r => r.class === cls && (r.overMM < nominalMM || (r.overMM === 0 && nominalMM > 0)) && nominalMM <= r.upToMM);
    if (k < 0) continue;
    const r = t.rows[k];
    return { class: cls, nominalMM, upperUM: r.upperUM, lowerUM: r.lowerUM, maxMM: nominalMM + r.upperUM / 1000, minMM: nominalMM + r.lowerUM / 1000, table: t.id, row: k, estimate: r.estimate === true, ...(r.source !== undefined ? { source: r.source } : {}) };
  }
  const has = tables.flatMap(t => t.rows.filter(r => r.class === cls).map(r => `over ${r.overMM} up to ${r.upToMM}`));
  throw new FitError('FIT_TABLE_MISS', `no row for ${cls} at Ø${+nominalMM.toFixed(6)} mm in ${tables.length ? tables.map(t => t.id).join(', ') : 'no fit table'}: load a row for ${cls} whose range holds ${+nominalMM.toFixed(6)} mm${has.length ? ` (${cls} has ${has.join('; ')})` : ` (no ${cls} rows loaded)`}. Limits are never computed: ISO 286's formula does not reproduce its own table.`);
}

export interface FitLimits {
  readonly hole: FitLimit; readonly shaft: FitLimit;
  /** EI − es and ES − ei (µm): the least and the greatest clearance; negative is interference. */
  readonly clearanceMinUM: number; readonly clearanceMaxUM: number;
  readonly kind: 'clearance' | 'transition' | 'interference';
  /** Whether either row is an estimate. */
  readonly estimate: boolean;
}
/** A hole class and a shaft class at one nominal size. */
export function fitLimits(tables: readonly FitTable[], holeClass: string, shaftClass: string, nominalMM: number): FitLimits {
  if (!isHoleClass(holeClass)) throw new FitError('FIT_FACE', `${holeClass} is a shaft's class: a hole takes a capital letter (H7)`);
  if (isHoleClass(shaftClass)) throw new FitError('FIT_FACE', `${shaftClass} is a hole's class: a shaft takes a small letter (g6)`);
  const hole = lookupFit(tables, holeClass, nominalMM), shaft = lookupFit(tables, shaftClass, nominalMM);
  const min = hole.lowerUM - shaft.upperUM, max = hole.upperUM - shaft.lowerUM;
  return { hole, shaft, clearanceMinUM: min, clearanceMaxUM: max, kind: min >= 0 ? 'clearance' : max <= 0 ? 'interference' : 'transition', estimate: hole.estimate || shaft.estimate };
}

/** A cylindrical face of a B-rep, by name or id, and its class. */
export interface FitFace { readonly brep: Brep; readonly face: string; readonly class: string }
/** One material condition: the sizes, the overlap the Boolean finds and the closed form for coaxial cylinders. */
export interface FitCondition { readonly holeMM: number; readonly shaftMM: number; readonly overlapMM3: number; readonly coaxialMM3: number }
export interface FitCheck {
  readonly limits: FitLimits;
  /** The axes' distance, and the length along them both faces cover. */
  readonly offsetMM: number; readonly lengthMM: number;
  /** The least radial clearance at MMC less the offset (negative: they meet). */
  readonly marginMM: number;
  readonly mmc: FitCondition; readonly lmc: FitCondition;
  /** A clearance fit whose bodies overlap at MMC. */
  readonly contradicted: boolean;
  readonly message: string;
}

type Cyl = { c: Point; a: Point; r: number; out: 1 | -1; lo: number; hi: number };
function cylinderOf(f: FitFace, role: 'hole' | 'shaft'): Cyl {
  const face = f.brep.faces.find(x => x.id === f.face) ?? f.brep.faces.find(x => x.name === f.face);
  if (!face) throw new FitError('FIT_FACE', `no face ${f.face}`);
  const g = faceGeometry(face);
  if (g.kind !== 'cylinder') throw new FitError('FIT_FACE', `${f.face} is not a cylinder: a ${role}'s class needs a cylindrical face`);
  if (role === 'hole' && g.out !== -1) throw new FitError('FIT_FACE', `${f.face} is a shaft's face (its material inside), not a hole's`);
  if (role === 'shaft' && g.out !== 1) throw new FitError('FIT_FACE', `${f.face} is a hole's face (its material outside), not a shaft's`);
  // Its extent along the axis: its loops' vertices projected (a cylinder's boundary circles lie square to it).
  const loops = new Set(face.loops), coedges = f.brep.coedges.filter(c => loops.has(c.loop)), edges = new Map(f.brep.edges.map(e => [e.id, e])), verts = new Map(f.brep.vertices.map(v => [v.id, v.point]));
  let lo = Infinity, hi = -Infinity;
  for (const c of coedges) { const e = edges.get(c.edge)!; for (const v of e.vertices) { const p = verts.get(v)!, s = (p[0] - g.c[0]) * g.a[0] + (p[1] - g.c[1]) * g.a[1] + (p[2] - g.c[2]) * g.a[2]; lo = Math.min(lo, s); hi = Math.max(hi, s); } }
  return { c: [...g.c] as Point, a: [...g.a] as Point, r: g.r, out: g.out, lo, hi };
}
const at = (c: Cyl, s: number): Point => [c.c[0] + c.a[0] * s, c.c[1] + c.a[1] * s, c.c[2] + c.a[2] * s];
/** A solid cylinder of radius r on axis a from p, length L (a part document: a circle sketch extruded). */
function cylinder(id: string, p: Point, a: Point, r: number, L: number): Brep {
  const x: Point = Math.abs(a[2]) < 0.9 ? [a[1], -a[0], 0] : [0, a[2], -a[1]], n = Math.hypot(...x), xAxis: Point = [x[0] / n, x[1] / n, x[2] / n];
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: `${id}s`, kind: 'sketch', profile: 'circle', center: [0, 0], radius: r, plane: { origin: p, normal: a, xAxis } },
    { id, kind: 'extrude', sketch: `${id}s`, height: L },
  ] };
  return evaluateCadPart(doc as Parameters<typeof evaluateCadPart>[0]).output(id).brep;
}

/** A hole face and a shaft face: their limits and the pair at MMC and LMC by the analytic Boolean. */
export function checkFit(tables: readonly FitTable[], hole: FitFace, shaft: FitFace): FitCheck {
  const H = cylinderOf(hole, 'hole'), S = cylinderOf(shaft, 'shaft');
  const cr = [H.a[1] * S.a[2] - H.a[2] * S.a[1], H.a[2] * S.a[0] - H.a[0] * S.a[2], H.a[0] * S.a[1] - H.a[1] * S.a[0]];
  if (Math.hypot(...cr) > 1e-9) throw new FitError('FIT_PAIR', `${hole.face} and ${shaft.face} are not on parallel axes`);
  if (Math.abs(2 * H.r - 2 * S.r) > 1e-6) throw new FitError('FIT_PAIR', `${hole.face} is Ø${+(2 * H.r).toFixed(6)} and ${shaft.face} Ø${+(2 * S.r).toFixed(6)}: a fit's classes apply to one nominal size, so model both at it`);
  const limits = fitLimits(tables, hole.class, shaft.class, 2 * H.r), nominal = limits.hole.nominalMM;
  // The shaft's axis in the hole's frame: its offset, and its extent on the hole's axis.
  const sign = H.a[0] * S.a[0] + H.a[1] * S.a[1] + H.a[2] * S.a[2] > 0 ? 1 : -1, d: Point = [S.c[0] - H.c[0], S.c[1] - H.c[1], S.c[2] - H.c[2]], along = d[0] * H.a[0] + d[1] * H.a[1] + d[2] * H.a[2];
  const offset = Math.hypot(d[0] - H.a[0] * along, d[1] - H.a[1] * along, d[2] - H.a[2] * along);
  const s0 = along + Math.min(sign * S.lo, sign * S.hi), s1 = along + Math.max(sign * S.lo, sign * S.hi), lo = Math.max(H.lo, s0), hi = Math.min(H.hi, s1), L = hi - lo;
  if (!(L > 1e-9)) throw new FitError('FIT_PAIR', `${hole.face} and ${shaft.face} do not overlap along their axis`);
  const condition = (tag: string, holeMM: number, shaftMM: number): FitCondition => {
    const rh = holeMM / 2, rs = shaftMM / 2, coaxial = rs > rh ? Math.PI * L * (rs * rs - rh * rh) : 0;
    // (Coaxial and line to line, the surfaces coincide: nothing between them, by arithmetic.)
    if (offset < 1e-9 && Math.abs(rs - rh) < 1e-9) return { holeMM, shaftMM, overlapMM3: 0, coaxialMM3: coaxial };
    // The shaft at its size over the overlap, less the hole's bore at its size, longer by 1 mm each way (no coplanar
    // ends): what is left is where the shaft would stand in the hole's material.
    const p0 = at(H, lo), sp: Point = [p0[0] + d[0] - H.a[0] * along, p0[1] + d[1] - H.a[1] * along, p0[2] + d[2] - H.a[2] * along];
    const pin = cylinder(`${tag}s`, sp, H.a, rs, L), bore = cylinder(`${tag}h`, at(H, lo - 1), H.a, rh, L + 2);
    let overlap = 0;
    try { const x = booleanAnalytic(pin, bore, 'difference'); overlap = x.bodies.length ? brepMassProperties(x, 1, { quadratureSegments: 12 }).volumeMM3 : 0; }
    catch (cause) { if (!(cause instanceof Error && /empty|no solid|nothing/i.test(cause.message))) throw cause; }
    return { holeMM, shaftMM, overlapMM3: Math.max(0, overlap), coaxialMM3: coaxial };
  };
  const mmc = condition('m', limits.hole.minMM, limits.shaft.maxMM), lmc = condition('l', limits.hole.maxMM, limits.shaft.minMM);
  const margin = (limits.clearanceMinUM / 1000) / 2 - offset, contradicted = limits.kind === 'clearance' && mmc.overlapMM3 > 1e-9 * Math.PI * L * H.r * H.r;
  const um = (x: number) => `${x > 0 ? '+' : ''}${+x.toFixed(3)}`;
  const message = `${hole.class}/${shaft.class} at Ø${+nominal.toFixed(6)}: ${limits.kind} fit, clearance ${um(limits.clearanceMinUM)} to ${um(limits.clearanceMaxUM)} µm` + (offset > 1e-9 ? `; the axes ${+offset.toFixed(6)} mm apart` : '')
    + (contradicted ? `; contradicted by the geometry: at MMC the shaft overlaps the hole by ${+mmc.overlapMM3.toPrecision(4)} mm³ over ${+L.toFixed(4)} mm` : '');
  return { limits, offsetMM: offset, lengthMM: L, marginMM: margin, mmc, lmc, contradicted, message };
}
