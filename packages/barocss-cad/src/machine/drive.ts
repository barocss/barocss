// R12c.6b (D161): sprockets and chain, pulleys and belts, couplings. Every size of a chain, a belt's section or a coupling
// is the user's row (none built in), citing its source or flagged an estimate; the wheels' outlines are geometry derived
// here in closed form, or the user's own profile.
//
// - A sprocket on the chain's pitch p and roller d1, z teeth: the roller seats centred on the pitch circle, its radius
//   R = p/(2 sin(π/z)) (the chord between neighbouring seats is p). Its tooth form `pivot-clearance` is derived here (not
//   ISO 606's, whose formulas were not read): a roller leaving its seat k turns about its neighbour's centre P_{k±1} at
//   distance p, so the flank that clears it is the circle of radius p − r_s about P_{k±1}. That circle touches the seat
//   circle (radius r_s about P_k) where the chord P_kP_{k±1} crosses it, since the radii add up to p: seat and flanks
//   meet tangentially. The tip circle is the user's; above the flanks' meeting point on the tooth's bisector, R cos(π/z) +
//   √((p − r_s)² − p²/4), the tooth is pointed (refused). Any other form is UNSUPPORTED_TOOTH_FORM.
// - A timing pulley on the belt's pitch p and pitch-line offset u, z grooves: the pitch diameter pz/π, the outside
//   diameter pz/π − 2u; each groove the user's profile [x along the land, depth below the outside circle] in the groove's
//   own frame, its first and last segments cut at the outside circle; the lands arcs of that circle between them.
// - A V pulley: the row's groove (angle α, datum width w_d, b above the datum line and h_f below it, spacing e, edge f)
//   revolved round the datum diameter the user gives. A flat pulley: a cylinder face, crowned by a circular arc of the
//   crown height the user gives.
// - An open belt between pitch radii R1 and R2 at centre distance C: sin β = (R1 − R2)/C, the length
//   L = 2C cos β + (π + 2β)R1 + (π − 2β)R2, the wraps π ± 2β. A chain on its sprockets' pitch circles: L/p pitches,
//   rounded up to whole (or even) links, the centre distance for that count solved back (L increases with C). The chordal
//   effect of the chain's polygon is not modelled. The belt as a band of the row's thickness t about its pitch line: the
//   offsets of the path at ±t/2, whose area between is L·t (each offset's length differs from L by πt).
// - A coupling: the row's envelope, a sleeve of its outside Ø and length with its two bores (stepped at the row's depth),
//   revolved; a bought item, its report carrying `bought` with the row's part number and supplier.
import type { Brep } from '../brep/brep-core.js';
import type { Curve, Point } from '../types.js';
import { arcCurve, extrudedProfile, lineCurve, reversed } from './gear.js';
import { evaluateCurve } from '../core/math.js';
import { evaluateCadPart } from '../part/part-model.js';
import { transformBrep } from '../brep/brep-transform.js';
import { KernelError } from '../core/barocss-error.js';

export type DriveCode = 'INVALID_INPUT' | 'UNSUPPORTED_TOOTH_FORM' | 'TOOTH_FORM' | 'BELT_GEOMETRY';
export class DriveError extends KernelError {
  constructor(readonly code: DriveCode, detail: string) { super(`drive: ${detail}`); this.name = 'DriveError'; }
}
const fail = (code: DriveCode, detail: string): never => { throw new DriveError(code, detail); };
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const r6 = (x: number) => +x.toFixed(6);
const TAU = 2 * Math.PI;

export interface ChainRow { readonly kind: 'chain'; readonly id: string; readonly pitchMM: number; readonly rollerDiameterMM: number; readonly innerWidthMM?: number; readonly plateHeightMM?: number; readonly source?: string; readonly estimate?: boolean }
export interface TimingBeltRow { readonly kind: 'timing-belt'; readonly id: string; readonly pitchMM: number; readonly pitchLineOffsetMM: number; readonly groove: readonly (readonly [number, number])[]; readonly thicknessMM?: number; readonly source?: string; readonly estimate?: boolean }
export interface VBeltRow { readonly kind: 'v-belt'; readonly id: string; readonly angleDeg: number; readonly datumWidthMM: number; readonly aboveDatumMM: number; readonly belowDatumMM: number; readonly spacingMM: number; readonly edgeMM: number; readonly thicknessMM?: number; readonly source?: string; readonly estimate?: boolean }
export interface FlatBeltRow { readonly kind: 'flat-belt'; readonly id: string; readonly widthMM: number; readonly thicknessMM: number; readonly source?: string; readonly estimate?: boolean }
export interface CouplingRow { readonly kind: 'coupling'; readonly id: string; readonly type?: string; readonly boreMM: readonly [number, number]; readonly outsideMM: number; readonly lengthMM: number; readonly boreStepMM?: number; readonly partNumber?: string; readonly supplier?: string; readonly source?: string; readonly estimate?: boolean }
export type DriveRow = ChainRow | TimingBeltRow | VBeltRow | FlatBeltRow | CouplingRow;
export type BeltRow = TimingBeltRow | VBeltRow | FlatBeltRow;

const FIELDS: Record<DriveRow['kind'], { req: string[]; opt: string[] }> = {
  chain: { req: ['pitchMM', 'rollerDiameterMM'], opt: ['innerWidthMM', 'plateHeightMM'] },
  'timing-belt': { req: ['pitchMM', 'pitchLineOffsetMM', 'groove'], opt: ['thicknessMM'] },
  'v-belt': { req: ['angleDeg', 'datumWidthMM', 'aboveDatumMM', 'belowDatumMM', 'spacingMM', 'edgeMM'], opt: ['thicknessMM'] },
  'flat-belt': { req: ['widthMM', 'thicknessMM'], opt: [] },
  coupling: { req: ['boreMM', 'outsideMM', 'lengthMM'], opt: ['type', 'boreStepMM', 'partNumber', 'supplier'] },
};
/** Why a drive row is not one, or null. */
export function driveRowProblem(r: unknown): string | null {
  if (typeof r !== 'object' || r === null || Array.isArray(r)) return 'a drive row is an object { kind: chain | timing-belt | v-belt | flat-belt | coupling, id, … , source | estimate }';
  const o = r as Record<string, unknown>, kind = o.kind as DriveRow['kind'];
  if (!(kind in FIELDS)) return `a drive row's kind is chain, timing-belt, v-belt, flat-belt or coupling (not ${String(o.kind)})`;
  const at = typeof o.id === 'string' && o.id.trim() ? `${kind} row ${o.id}` : '';
  if (!at) return `a ${kind} row needs an id`;
  const f = FIELDS[kind];
  for (const k of Object.keys(o)) if (!['kind', 'id', 'source', 'estimate', ...f.req, ...f.opt].includes(k)) return `${at}: unknown field ${k}`;
  for (const k of f.req) if (o[k] === undefined) return `${at}: ${k} is missing`;
  const pos = (k: string) => o[k] === undefined || (num(o[k]) && (o[k] as number) > 0) ? null : `${at}: ${k} must be a number of mm above 0`;
  for (const k of ['pitchMM', 'rollerDiameterMM', 'innerWidthMM', 'plateHeightMM', 'thicknessMM', 'datumWidthMM', 'aboveDatumMM', 'belowDatumMM', 'spacingMM', 'edgeMM', 'widthMM', 'outsideMM', 'lengthMM', 'boreStepMM']) { const p = pos(k); if (p) return p; }
  if (kind === 'chain' && !((o.rollerDiameterMM as number) < (o.pitchMM as number))) return `${at}: the roller Ø${o.rollerDiameterMM} must be under the pitch ${o.pitchMM}`;
  if (kind === 'timing-belt') {
    if (!num(o.pitchLineOffsetMM) || (o.pitchLineOffsetMM as number) < 0) return `${at}: pitchLineOffsetMM must be a number of mm, 0 or more`;
    const g = o.groove;
    if (!Array.isArray(g) || g.length < 3 || !g.every(q => Array.isArray(q) && q.length === 2 && num(q[0]) && num(q[1]))) return `${at}: groove must be at least three points [x along the land, depth below the outside circle]`;
    const pts = g as [number, number][];
    if (!(pts[0][1] <= 0 && pts[pts.length - 1][1] <= 0)) return `${at}: the groove's first and last points sit on or above the outside circle (depth ≤ 0)`;
    if (!pts.slice(1, -1).every(q => q[1] > 0)) return `${at}: the groove's inner points lie below the outside circle (depth > 0)`;
    for (let i = 1; i < pts.length; i++) if (!(pts[i][0] > pts[i - 1][0] || i > 1 && i < pts.length - 1 && pts[i][0] >= pts[i - 1][0])) return `${at}: the groove runs along +x (x never falling; its ends strictly)`;
  }
  if (kind === 'v-belt') {
    if (!(num(o.angleDeg) && (o.angleDeg as number) > 0 && (o.angleDeg as number) < 120)) return `${at}: angleDeg must be a number of degrees between 0 and 120`;
    const t = Math.tan((o.angleDeg as number) * Math.PI / 360), wt = (o.datumWidthMM as number) + 2 * (o.aboveDatumMM as number) * t, wb = (o.datumWidthMM as number) - 2 * (o.belowDatumMM as number) * t;
    if (!(wb > 0)) return `${at}: the groove's sides meet above its bottom (its bottom width ${r6(wb)} mm): a smaller depth below the datum`;
    if (!((o.spacingMM as number) >= wt && (o.edgeMM as number) >= wt / 2)) return `${at}: grooves ${r6(wt)} mm wide at the top need a spacing of at least that and an edge of half`;
  }
  if (kind === 'coupling') {
    const b = o.boreMM;
    if (!(Array.isArray(b) && b.length === 2 && b.every(x => num(x) && x > 0))) return `${at}: boreMM must be [Ø at the start, Ø at the end], numbers of mm above 0`;
    if (!(Math.max(b[0] as number, b[1] as number) < (o.outsideMM as number))) return `${at}: its bores must be under its outside Ø${o.outsideMM}`;
    if (o.boreStepMM !== undefined && !((o.boreStepMM as number) < (o.lengthMM as number))) return `${at}: the bores' step at ${o.boreStepMM} must lie inside its length ${o.lengthMM}`;
    for (const k of ['type', 'partNumber', 'supplier']) if (o[k] !== undefined && typeof o[k] !== 'string') return `${at}: ${k} must be text`;
  }
  if ((o.source !== undefined) === (o.estimate === true)) return `${at}: cite its source or say estimate: true — ${o.source !== undefined ? 'not both' : 'never neither'}`;
  if (o.source !== undefined && typeof o.source !== 'string') return `${at}: source must be text`;
  return null;
}
const rowOf = <K extends DriveRow['kind']>(row: unknown, kind: K): Extract<DriveRow, { kind: K }> => {
  const p = driveRowProblem(row); if (p) fail('INVALID_INPUT', p);
  if ((row as DriveRow).kind !== kind) fail('INVALID_INPUT', `the row ${(row as DriveRow).id} is a ${(row as DriveRow).kind} row, not a ${kind}`);
  return row as Extract<DriveRow, { kind: K }>;
};

type V2 = [number, number];
const P3 = (v: V2): Point => [v[0], v[1], 0];
const ang = (v: V2) => Math.atan2(v[1], v[0]);
const norm = (a: number) => { const t = a % TAU; return t < 0 ? t + TAU : t; };
/** A circular arc about centre c, radius r, from angle a0 by sweep (+ counter-clockwise). */
function arcAbout(id: string, c: V2, r: number, a0: number, sweep: number): Curve {
  const k = arcCurve(id, r, a0, sweep);
  return { ...k, controlPoints: k.controlPoints.map(q => [q[0] + c[0], q[1] + c[1], 0] as Point) };
}
/** The two intersections of the circle about O (radius a) and the circle about Q (radius b): [clockwise of Q, counter-clockwise]. */
function meet(a: number, Q: V2, b: number): [V2, V2] | null {
  const d = Math.hypot(Q[0], Q[1]), x = (a * a - b * b + d * d) / (2 * d), h2 = a * a - x * x;
  if (!(h2 > 0)) return null;
  const h = Math.sqrt(h2), u: V2 = [Q[0] / d, Q[1] / d];
  return [[x * u[0] + h * u[1], x * u[1] - h * u[0]], [x * u[0] - h * u[1], x * u[1] + h * u[0]]];
}
const bore = (bd: number) => bd > 0 ? [{ name: 'bore#1', curve: arcCurve('b', bd / 2, 0, -Math.PI) }, { name: 'bore#2', curve: arcCurve('b', bd / 2, -Math.PI, -Math.PI) }] : [];
function boreCheck(bd: number | undefined, rim: number | undefined, below: number, what: string): number {
  const d = bd ?? 0, m = rim ?? 1;
  if (!(num(d) && d >= 0) || !(num(m) && m >= 0)) fail('INVALID_INPUT', 'boreDiameterMM and minimumRimMM must be numbers of mm, 0 or more');
  if (d > 0 && !(d / 2 <= below - m)) fail('INVALID_INPUT', `a bore of ${d} mm leaves less than the ${m} mm rim below ${what} (Ø${r6(2 * below)}): at most Ø${r6(2 * (below - m))}`);
  return d;
}
/** The least distance from X to a curve (samples, then golden-section about the nearest). */
function curveDistance(c: Curve, X: V2): number {
  const f = (t: number) => { const p = evaluateCurve(c, t); return Math.hypot(p[0] - X[0], p[1] - X[1]); };
  let best = Infinity, bi = 0;
  for (let i = 0; i <= 32; i++) { const v = f(i / 32); if (v < best) { best = v; bi = i; } }
  let lo = Math.max(0, bi - 1) / 32, hi = Math.min(32, bi + 1) / 32;
  const gr = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 50; i++) { const x1 = hi - gr * (hi - lo), x2 = lo + gr * (hi - lo); if (f(x1) <= f(x2)) hi = x2; else lo = x1; }
  return Math.min(best, f((lo + hi) / 2));
}

// ---------------------------------------------------------------- sprockets

export const sprocketPitchDiameter = (pitchMM: number, teeth: number) => pitchMM / Math.sin(Math.PI / teeth);
/** The tip's limits for a chain, teeth and seat Ø: above the seats' edge, below the flanks' meeting point (both Ø). */
export function sprocketLimits(chain: ChainRow, teeth: number, seatDiameterMM = chain.rollerDiameterMM): { seatEdgeDiameterMM: number; pointedTipDiameterMM: number; pitchDiameterMM: number } {
  const p = chain.pitchMM, rs = seatDiameterMM / 2, z = teeth, R = p / (2 * Math.sin(Math.PI / z)), rf = p - rs;
  return { seatEdgeDiameterMM: 2 * Math.hypot(R - rs * Math.sin(Math.PI / z), rs * Math.cos(Math.PI / z)), pointedTipDiameterMM: 2 * (R * Math.cos(Math.PI / z) + Math.sqrt(Math.max(0, rf * rf - p * p / 4))), pitchDiameterMM: 2 * R };
}
export interface SprocketSpec {
  readonly chain: ChainRow; readonly teeth: number;
  /** The tip circle's Ø (the user's). */
  readonly tipDiameterMM: number;
  /** The tooth's width across the chain (the user's). */
  readonly widthMM: number;
  /** The seat's Ø, at least the roller's (default the roller's). */
  readonly seatDiameterMM?: number;
  readonly toothForm?: 'pivot-clearance';
  readonly boreDiameterMM?: number; readonly minimumRimMM?: number;
}
export interface SprocketReport {
  readonly generator: 'sprocket@0'; readonly chain: string; readonly chainEstimate: boolean; readonly chainSource?: string;
  readonly pitchMM: number; readonly rollerDiameterMM: number; readonly teeth: number; readonly toothForm: 'pivot-clearance';
  readonly pitchDiameterMM: number; readonly seatDiameterMM: number; readonly rootDiameterMM: number; readonly flankRadiusMM: number;
  readonly tipDiameterMM: number; readonly pointedTipDiameterMM: number; readonly widthMM: number;
  /** The least gap between a roller turning out of its seat about its neighbour and the built teeth (measured): r_s − r_1. */
  readonly engagementClearanceMM: number;
  readonly warnings: readonly string[];
  readonly manufacturingValidated: false;
}
export function sprocketProfile(spec: SprocketSpec): { pieces: { name: string; curve: Curve }[]; bore: { name: string; curve: Curve }[]; report: SprocketReport } {
  const chain = rowOf(spec.chain, 'chain'), z = spec.teeth, p = chain.pitchMM, r1 = chain.rollerDiameterMM / 2;
  if (spec.toothForm !== undefined && spec.toothForm !== 'pivot-clearance') fail('UNSUPPORTED_TOOTH_FORM', `tooth form ${String(spec.toothForm)}: only pivot-clearance is derived here (ISO 606's formulas were not read; load none, the form is this kernel's)`);
  if (!(Number.isInteger(z) && z >= 6 && z <= 200)) fail('INVALID_INPUT', 'teeth must be a whole number, 6 to 200');
  if (!(num(spec.widthMM) && spec.widthMM > 0)) fail('INVALID_INPUT', 'widthMM must be a number of mm above 0');
  const ds = spec.seatDiameterMM ?? chain.rollerDiameterMM, rs = ds / 2;
  if (!(num(ds) && ds >= chain.rollerDiameterMM)) fail('INVALID_INPUT', `the seat Ø${ds} must be at least the roller's Ø${chain.rollerDiameterMM}`);
  if (!(rs < p / 2)) fail('TOOTH_FORM', `a seat of Ø${ds} on a pitch of ${p} leaves no tooth (r_s ≥ p/2)`);
  const R = p / (2 * Math.sin(Math.PI / z)), rf = p - rs, Rt = spec.tipDiameterMM / 2;
  const pointed = R * Math.cos(Math.PI / z) + Math.sqrt(rf * rf - p * p / 4), seatEdge = Math.hypot(R - rs * Math.sin(Math.PI / z), rs * Math.cos(Math.PI / z));
  if (!(num(spec.tipDiameterMM) && Rt > seatEdge)) fail('TOOTH_FORM', `the tip Ø${spec.tipDiameterMM} must be above where the flanks leave the seats (Ø${r6(2 * seatEdge)})`);
  if (!(Rt < pointed - 1e-9)) fail('TOOTH_FORM', `the tip Ø${spec.tipDiameterMM} reaches the flanks' meeting point: the teeth are pointed at Ø${r6(2 * pointed)} (a smaller tip)`);
  const bd = boreCheck(spec.boreDiameterMM, spec.minimumRimMM, R - rs, 'the roots');
  const P = (k: number): V2 => [R * Math.cos(TAU * k / z), R * Math.sin(TAU * k / z)];
  const pieces: { name: string; curve: Curve }[] = [];
  for (let k = 0; k < z; k++) {
    const Pk = P(k), Pm = P(k - 1), Pn = P(k + 1), n = k + 1;
    // Down the flank about P_{k−1} from the tip to the seat, round the seat (clockwise about P_k), up the flank about P_{k+1}.
    const tipIn = meet(Rt, Pm, rf)![1], tIn: V2 = [Pk[0] - Pm[0], Pk[1] - Pm[1]], a0 = ang([tipIn[0] - Pm[0], tipIn[1] - Pm[1]]);
    pieces.push({ name: `flank${2 * n - 1}`, curve: arcAbout(`fi${k}`, Pm, rf, a0, norm(ang(tIn) - a0)) });
    const uIn: V2 = [(Pm[0] - Pk[0]) / p, (Pm[1] - Pk[1]) / p];
    pieces.push({ name: `seat${n}`, curve: arcAbout(`s${k}`, Pk, rs, ang(uIn), -(Math.PI - TAU / z)) });
    const tipOut = meet(Rt, Pn, rf)![0], b0 = ang([Pk[0] - Pn[0], Pk[1] - Pn[1]]);
    pieces.push({ name: `flank${2 * n}`, curve: arcAbout(`fo${k}`, Pn, rf, b0, norm(ang([tipOut[0] - Pn[0], tipOut[1] - Pn[1]]) - b0)) });
    const nextIn = meet(Rt, Pk, rf)![1], t0 = ang(tipOut);
    pieces.push({ name: `tip${n}`, curve: arcAbout(`t${k}`, [0, 0], Rt, t0, norm(ang(nextIn) - t0)) });
  }
  // The roller leaving seat 0 about seat 1's centre, swung until it clears the tip circle: its gap to every built piece.
  let clear = Infinity;
  const Pk = P(0), Pn = P(1), g0 = ang([Pk[0] - Pn[0], Pk[1] - Pn[1]]);
  for (let i = 0; i <= 60; i++) {
    const g = g0 + i / 60 * Math.PI / 2, X: V2 = [Pn[0] + p * Math.cos(g), Pn[1] + p * Math.sin(g)];
    if (Math.hypot(X[0], X[1]) > Rt + r1) break;
    for (const q of pieces) clear = Math.min(clear, curveDistance(q.curve, X) - r1);
  }
  const warnings = chain.estimate ? [`the chain row ${chain.id} is an estimate`] : [];
  return { pieces, bore: bore(bd), report: { generator: 'sprocket@0', chain: chain.id, chainEstimate: chain.estimate === true, ...(chain.source ? { chainSource: chain.source } : {}), pitchMM: p, rollerDiameterMM: chain.rollerDiameterMM, teeth: z, toothForm: 'pivot-clearance',
    pitchDiameterMM: r6(2 * R), seatDiameterMM: ds, rootDiameterMM: r6(2 * (R - rs)), flankRadiusMM: r6(rf), tipDiameterMM: spec.tipDiameterMM, pointedTipDiameterMM: r6(2 * pointed), widthMM: spec.widthMM, engagementClearanceMM: r6(clear), warnings, manufacturingValidated: false } };
}
/** The sprocket as a solid, from z 0 through its width. Faces `<id>.seat<k>`, `.flank<j>`, `.tip<k>`, `.bore#1/#2`, `.face0/.face1`. */
export function sprocket(spec: SprocketSpec, options: { readonly id?: string } = {}): { brep: Brep; report: SprocketReport } {
  const id = options.id ?? 'sprocket', { pieces, bore: b, report } = sprocketProfile(spec);
  const brep = extrudedProfile(id, 'sprocket', pieces.map(q => ({ name: `${id}.${q.name}`, curve: q.curve })), b.map(q => ({ name: `${id}.${q.name}`, curve: q.curve })), spec.widthMM, spec.tipDiameterMM / 2 + 1);
  return { brep, report };
}

// ---------------------------------------------------------------- pulleys

export const timingPitchDiameter = (pitchMM: number, teeth: number) => pitchMM * teeth / Math.PI;
export interface PulleySpec {
  readonly belt: BeltRow;
  /** Timing: its grooves. */
  readonly teeth?: number;
  /** V: the datum Ø; flat: the face's Ø (at its crown). */
  readonly diameterMM?: number;
  /** V: the grooves (default 1). */
  readonly grooves?: number;
  /** Timing and flat: the face's width (a flat one at least the belt's). */
  readonly widthMM?: number;
  /** Flat: the crown's height (default 0). */
  readonly crownMM?: number;
  readonly boreDiameterMM?: number; readonly minimumRimMM?: number;
}
export interface PulleyReport {
  readonly generator: 'pulley@0'; readonly type: 'timing' | 'v' | 'flat'; readonly belt: string; readonly beltEstimate: boolean; readonly beltSource?: string;
  /** The belt's pitch line on it: timing pz/π, V the datum Ø, flat the face's Ø. */
  readonly pitchDiameterMM: number; readonly outsideDiameterMM: number; readonly widthMM: number;
  readonly teeth?: number; readonly grooves?: number; readonly grooveBottomDiameterMM?: number; readonly crownMM?: number;
  readonly warnings: readonly string[];
  readonly manufacturingValidated: false;
}
/** A revolved section loop (x radial, y axial; counter-clockwise), its sides tagged, as a solid about +Z. */
function revolved(id: string, segs: { kind: 'line' | 'arc'; start: V2; center?: V2; tag: string }[]): Brep {
  const sub = `${id}__r`, doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: `${sub}s`, kind: 'sketch', profile: 'loop', segments: segs.map(s => s.kind === 'line' ? { kind: 'line', start: s.start } : { kind: 'arc', start: s.start, center: s.center, direction: 'ccw' }), plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] }, sideTags: { outer: segs.map(s => s.tag) } },
    { id: sub, kind: 'revolve', sketch: `${sub}s`, axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 }] };
  const prefix = `${sub}.side[`;
  return transformBrep(evaluateCadPart(doc as unknown as Parameters<typeof evaluateCadPart>[0]).output(sub).brep, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
    nm => nm.split('|').map(q => q.startsWith(prefix) ? `${id}.${q.slice(prefix.length, q.indexOf(']'))}${q.slice(q.indexOf(']') + 1)}` : q).join('|'));
}
/**
 * A pulley for the belt row: timing (its grooves the row's profile, extruded through `widthMM`), V (the row's grooves
 * revolved round the datum Ø) or flat (a crowned face, revolved). Faces: timing `<id>.groove<k>.<j>` (the profile's
 * segments), `.land<k>`, `.bore#1/#2`, `.face0/.face1`; V `.rim0`, `.flankA<k>`, `.bottom<k>`, `.flankB<k>`, `.rim<k>`, flat
 * `.face`, both with `.bore`, `.face0/.face1` (the ends), each revolved face in two halves `#1/#2`.
 */
export function pulley(spec: PulleySpec, options: { readonly id?: string } = {}): { brep: Brep; report: PulleyReport } {
  const id = options.id ?? 'pulley', belt = spec.belt;
  const p0 = driveRowProblem(belt); if (p0) fail('INVALID_INPUT', p0);
  if (belt.kind !== 'timing-belt' && belt.kind !== 'v-belt' && belt.kind !== 'flat-belt') fail('INVALID_INPUT', `the row ${(belt as DriveRow).id} is a ${(belt as DriveRow).kind} row, not a belt`);
  const head = { generator: 'pulley@0' as const, belt: belt.id, beltEstimate: belt.estimate === true, ...(belt.source ? { beltSource: belt.source } : {}), manufacturingValidated: false as const };
  const warnings = belt.estimate ? [`the belt row ${belt.id} is an estimate`] : [];
  if (belt.kind === 'timing-belt') {
    const z = spec.teeth ?? NaN, w = spec.widthMM ?? NaN;
    if (!(Number.isInteger(z) && z >= 6 && z <= 400)) fail('INVALID_INPUT', 'a timing pulley needs teeth, a whole number 6 to 400');
    if (!(num(w) && w > 0)) fail('INVALID_INPUT', 'a timing pulley needs widthMM, a number of mm above 0');
    const PD = timingPitchDiameter(belt.pitchMM, z), Ro = PD / 2 - belt.pitchLineOffsetMM, depth = Math.max(...belt.groove.map(q => q[1]));
    if (!(Ro - depth > 0)) fail('TOOTH_FORM', `grooves ${depth} deep reach the axis of a pulley Ø${r6(2 * Ro)}`);
    const bd = boreCheck(spec.boreDiameterMM, spec.minimumRimMM, Ro - depth, 'the grooves\' bottoms');
    // A groove's points in its own frame (x along the land's tangent, depth below the outside circle), turned to φ_k.
    const at = (phi: number, q: readonly [number, number]): V2 => { const c = Math.cos(phi), s = Math.sin(phi), y = Ro - q[1]; return [c * y - s * q[0], s * y + c * q[0]]; };
    const cut = (A: V2, B: V2): V2 => {
      // (Where the segment A → B crosses the outside circle: A on or beyond it, B inside.)
      const d: V2 = [B[0] - A[0], B[1] - A[1]], a = d[0] * d[0] + d[1] * d[1], b = 2 * (A[0] * d[0] + A[1] * d[1]), c = A[0] * A[0] + A[1] * A[1] - Ro * Ro, t = (-b - Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
      return [A[0] + t * d[0], A[1] + t * d[1]];
    };
    const g = belt.groove, gaps: V2[][] = [];
    for (let k = 0; k < z; k++) {
      const phi = TAU * k / z, pts = g.map(q => at(phi, q));
      // (The first segment runs in from the outside circle or beyond it, the last out: both cut at the circle.)
      const L = pts.length - 1; pts[0] = cut(pts[0], pts[1]); pts[L] = cut(pts[L], pts[L - 1]);
      gaps.push(pts);
    }
    const span = norm(ang(gaps[0][gaps[0].length - 1]) - ang(gaps[0][0]));
    if (!(span < TAU / z - 1e-9)) fail('TOOTH_FORM', `each groove spans ${r6(span * 180 / Math.PI)}° of the outside circle, no land left between ${z} grooves (${r6(360 / z)}° apart)`);
    const pieces: { name: string; curve: Curve }[] = [];
    gaps.forEach((pts, k) => {
      for (let j = 0; j + 1 < pts.length; j++) pieces.push({ name: `groove${k + 1}.${j + 1}`, curve: lineCurve(`g${k}_${j}`, P3(pts[j]), P3(pts[j + 1])) });
      const end = pts[pts.length - 1], next = gaps[(k + 1) % z][0], a0 = ang(end);
      pieces.push({ name: `land${k + 1}`, curve: arcAbout(`l${k}`, [0, 0], Ro, a0, norm(ang(next) - a0)) });
    });
    const brep = extrudedProfile(id, 'pulley', pieces.map(q => ({ name: `${id}.${q.name}`, curve: q.curve })), bore(bd).map(q => ({ name: `${id}.${q.name}`, curve: q.curve })), w, Ro + 1);
    return { brep, report: { ...head, type: 'timing', pitchDiameterMM: r6(PD), outsideDiameterMM: r6(2 * Ro), widthMM: w, teeth: z, grooveBottomDiameterMM: r6(2 * (Ro - depth)), warnings } };
  }
  const d = spec.diameterMM ?? NaN;
  if (!(num(d) && d > 0)) fail('INVALID_INPUT', `a ${belt.kind === 'v-belt' ? 'V' : 'flat'} pulley needs diameterMM, a number of mm above 0`);
  if (belt.kind === 'v-belt') {
    const n = spec.grooves ?? 1;
    if (!(Number.isInteger(n) && n >= 1 && n <= 20)) fail('INVALID_INPUT', 'grooves must be a whole number, 1 to 20');
    const t = Math.tan(belt.angleDeg * Math.PI / 360), ro = d / 2 + belt.aboveDatumMM, rb = d / 2 - belt.belowDatumMM;
    const wt = belt.datumWidthMM + 2 * belt.aboveDatumMM * t, wb = belt.datumWidthMM - 2 * belt.belowDatumMM * t, W = (n - 1) * belt.spacingMM + 2 * belt.edgeMM;
    if (!(rb > 0)) fail('TOOTH_FORM', `a datum Ø${d} is too small for grooves ${belt.belowDatumMM} below it`);
    const bd = boreCheck(spec.boreDiameterMM, spec.minimumRimMM, rb, 'the grooves\' bottoms'), ri = bd / 2;
    if (!(ri > 0)) fail('INVALID_INPUT', 'a V pulley needs a bore (its section is revolved round the axis)');
    const segs: { kind: 'line'; start: V2; tag: string }[] = [{ kind: 'line', start: [ri, 0], tag: 'face0' }, { kind: 'line', start: [ro, 0], tag: 'rim0' }];
    for (let i = 0; i < n; i++) {
      const y = belt.edgeMM + i * belt.spacingMM;
      segs.push({ kind: 'line', start: [ro, y - wt / 2], tag: `flankA${i + 1}` }, { kind: 'line', start: [rb, y - wb / 2], tag: `bottom${i + 1}` }, { kind: 'line', start: [rb, y + wb / 2], tag: `flankB${i + 1}` }, { kind: 'line', start: [ro, y + wt / 2], tag: `rim${i + 1}` });
    }
    segs.push({ kind: 'line', start: [ro, W], tag: 'face1' }, { kind: 'line', start: [ri, W], tag: 'bore' });
    return { brep: revolved(id, segs), report: { ...head, type: 'v', pitchDiameterMM: d, outsideDiameterMM: r6(2 * ro), widthMM: r6(W), grooves: n, grooveBottomDiameterMM: r6(2 * rb), warnings } };
  }
  const W = spec.widthMM ?? NaN, hc = spec.crownMM ?? 0;
  if (!(num(W) && W > 0)) fail('INVALID_INPUT', 'a flat pulley needs widthMM, a number of mm above 0');
  if (!(num(hc) && hc >= 0 && hc < W / 2)) fail('INVALID_INPUT', `crownMM must be a number of mm, 0 or more and under half the width ${W}`);
  const r = d / 2, bd = boreCheck(spec.boreDiameterMM, spec.minimumRimMM, r - hc, 'the face\'s edge'), ri = bd / 2;
  if (!(ri > 0)) fail('INVALID_INPUT', 'a flat pulley needs a bore (its section is revolved round the axis)');
  if (belt.widthMM > W) warnings.push(`FACE_WIDTH: the belt ${belt.widthMM} mm wide runs off a face ${W} mm wide`);
  // The crown: the circle through (r − h, 0), (r, W/2), (r − h, W); its centre (r − ρ, W/2), ρ = (h² + W²/4)/(2h).
  const rho = hc > 0 ? (hc * hc + W * W / 4) / (2 * hc) : 0;
  const segs: { kind: 'line' | 'arc'; start: V2; center?: V2; tag: string }[] = [{ kind: 'line', start: [ri, 0], tag: 'face0' },
    hc > 0 ? { kind: 'arc', start: [r - hc, 0], center: [r - rho, W / 2], tag: 'face' } : { kind: 'line', start: [r, 0], tag: 'face' },
    { kind: 'line', start: [r - hc, W], tag: 'face1' }, { kind: 'line', start: [ri, W], tag: 'bore' }];
  return { brep: revolved(id, segs), report: { ...head, type: 'flat', pitchDiameterMM: d, outsideDiameterMM: d, widthMM: W, crownMM: hc, warnings } };
}

// ---------------------------------------------------------------- belts and chains

/** An open belt's length between pitch radii R1 and R2 at centre distance C, and the wraps (degrees). */
export function openBeltLength(R1: number, R2: number, C: number): { lengthMM: number; betaDeg: number; wrap1Deg: number; wrap2Deg: number } {
  if (!(num(R1) && R1 > 0 && num(R2) && R2 > 0 && num(C))) fail('INVALID_INPUT', 'the pitch radii and the centre distance must be numbers of mm above 0');
  if (!(C > R1 + R2)) fail('BELT_GEOMETRY', `the wheels' pitch circles (R ${r6(R1)} and ${r6(R2)}) overlap at a centre distance of ${r6(C)}: at least ${r6(R1 + R2)}`);
  const b = Math.asin((R1 - R2) / C);
  return { lengthMM: 2 * C * Math.cos(b) + (Math.PI + 2 * b) * R1 + (Math.PI - 2 * b) * R2, betaDeg: b * 180 / Math.PI, wrap1Deg: 180 + 2 * b * 180 / Math.PI, wrap2Deg: 180 - 2 * b * 180 / Math.PI };
}
/** A chain on two sprockets' pitch circles: L/p pitches, rounded up to whole (or even) links, the centre distance for that count. */
export function chainLinks(pitchMM: number, R1: number, R2: number, C: number, rounding: 'whole' | 'even' = 'whole'): { pitches: number; links: number; centerDistanceMM: number } {
  const L = openBeltLength(R1, R2, C).lengthMM, x = L / pitchMM;
  let N = Math.ceil(x - 1e-9);
  if (rounding === 'even' && N % 2) N += 1;
  // (L(C) increases with C: bisection from the least distance to one past the given one plus a pitch per link.)
  let lo = R1 + R2 + 1e-9, hi = C + (N - x + 1) * pitchMM;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (openBeltLength(R1, R2, m).lengthMM < N * pitchMM) lo = m; else hi = m; }
  return { pitches: x, links: N, centerDistanceMM: (lo + hi) / 2 };
}
export interface BeltSpec {
  readonly row: ChainRow | BeltRow;
  /** The two wheels' pitch radii; the first at the origin, the second at (C, 0). */
  readonly pitchRadiiMM: readonly [number, number];
  readonly centerDistanceMM: number;
  /** Chains: whole (default) or even links. */
  readonly rounding?: 'whole' | 'even';
  /** The band's width across (default the row's: a flat belt's width, a chain's inner width, else 5). */
  readonly widthMM?: number;
}
export interface BeltReport {
  readonly generator: 'belt@0'; readonly row: string; readonly kind: DriveRow['kind']; readonly rowEstimate: boolean; readonly rowSource?: string;
  readonly pitchRadiiMM: readonly [number, number]; readonly centerDistanceMM: number; readonly lengthMM: number; readonly wrapDeg: readonly [number, number];
  /** Chains: pitches at this distance, the links, the distance for them. */
  readonly chain?: { readonly pitches: number; readonly links: number; readonly centerDistanceMM: number };
  readonly bandThicknessMM: number; readonly bandWidthMM: number; readonly bandEstimate: boolean;
  readonly warnings: readonly string[];
}
/**
 * The belt or chain as a band about its pitch path, the row's thickness (a chain's plate height) across it and `widthMM`
 * wide, from z 0: faces `<id>.outer#k`, `.inner#k` (the arcs and lines), `.face0/.face1`. Wheel 1 at the origin, wheel 2
 * at (C, 0).
 */
export function beltBand(spec: BeltSpec, options: { readonly id?: string } = {}): { brep: Brep; report: BeltReport } {
  const id = options.id ?? 'belt', row = spec.row;
  const p0 = driveRowProblem(row); if (p0) fail('INVALID_INPUT', p0);
  if (row.kind === ('coupling' as DriveRow['kind'])) fail('INVALID_INPUT', `the row ${row.id} is a coupling, not a belt or a chain`);
  const [R1, R2] = spec.pitchRadiiMM, C = spec.centerDistanceMM, len = openBeltLength(R1, R2, C), warnings: string[] = [];
  const chain = row.kind === 'chain' ? chainLinks(row.pitchMM, R1, R2, C, spec.rounding ?? 'whole') : undefined;
  if (chain && Math.abs(chain.pitches - chain.links) > 1e-6) warnings.push(`CHAIN_LINKS: ${r6(chain.pitches)} pitches at ${r6(C)} mm; ${chain.links} links need a centre distance of ${r6(chain.centerDistanceMM)} mm`);
  const tRow = row.kind === 'chain' ? row.plateHeightMM : row.thicknessMM, t = tRow ?? (row.kind === 'chain' ? row.rollerDiameterMM : 2), bandEst = tRow === undefined;
  if (bandEst) warnings.push(`the band's thickness ${t} mm is a stand-in (the row gives none): its volume is not the ${row.kind === 'chain' ? 'chain' : 'belt'}'s`);
  const w = spec.widthMM ?? (row.kind === 'flat-belt' ? row.widthMM : row.kind === 'chain' ? row.innerWidthMM ?? 5 : 5);
  if (!(num(w) && w > 0)) fail('INVALID_INPUT', 'widthMM must be a number of mm above 0');
  if (!(t / 2 < Math.min(R1, R2))) fail('BELT_GEOMETRY', `a band ${t} thick is too thick for a wheel of pitch radius ${r6(Math.min(R1, R2))}`);
  // The path's top normal at γ = π/2 − β (sin β = (R1 − R2)/C) on both wheels.
  const g = Math.PI / 2 - len.betaDeg * Math.PI / 180, ring = (off: number, tag: string, ccw: boolean) => {
    const a = R1 + off, b = R2 + off, A1 = (s: number): V2 => [a * Math.cos(s), a * Math.sin(s)], A2 = (s: number): V2 => [C + b * Math.cos(s), b * Math.sin(s)];
    const list = [
      { name: `${tag}#1`, curve: arcAbout(`${tag}a2`, [C, 0], b, -g, 2 * g) },
      { name: `${tag}#2`, curve: lineCurve(`${tag}l1`, P3(A2(g)), P3(A1(g))) },
      { name: `${tag}#3`, curve: arcAbout(`${tag}a1`, [0, 0], a, g, TAU - 2 * g) },
      { name: `${tag}#4`, curve: lineCurve(`${tag}l2`, P3(A1(-g)), P3(A2(-g))) },
    ];
    if (ccw) return list;
    // (A hole runs clockwise: the pieces reversed, each turned round.)
    return list.reverse().map(q => ({ name: q.name, curve: reversed(q.curve) }));
  };
  const outer = ring(t / 2, 'outer', true), inner = ring(-t / 2, 'inner', false);
  const brep = extrudedProfile(id, 'belt', outer.map(q => ({ name: `${id}.${q.name}`, curve: q.curve })), inner.map(q => ({ name: `${id}.${q.name}`, curve: q.curve })), w, C + R1 + R2 + t + 1);
  return { brep, report: { generator: 'belt@0', row: row.id, kind: row.kind, rowEstimate: row.estimate === true, ...(row.source ? { rowSource: row.source } : {}), pitchRadiiMM: [R1, R2], centerDistanceMM: C, lengthMM: len.lengthMM, wrapDeg: [len.wrap1Deg, len.wrap2Deg],
    ...(chain ? { chain } : {}), bandThicknessMM: t, bandWidthMM: w, bandEstimate: bandEst, warnings } };
}

// ---------------------------------------------------------------- couplings

export interface CouplingReport {
  readonly generator: 'coupling@0'; readonly row: string; readonly type?: string; readonly estimate: boolean; readonly source?: string;
  readonly boreMM: readonly [number, number]; readonly outsideMM: number; readonly lengthMM: number; readonly boreStepMM: number;
  /** A bought item: the BOM's defaults from the row. */
  readonly bought: { readonly bought: true; readonly partNumber?: string; readonly supplier?: string; readonly source?: string };
  readonly envelopeOnly: true;
}
/** The coupling's envelope from its row, axis +Z from z 0: faces `<id>.outside`, `.bore1`, `.bore2`, `.step`, `.face0/.face1` (each in two halves `#1/#2`). */
export function couplingEnvelope(rowIn: CouplingRow, options: { readonly id?: string } = {}): { brep: Brep; report: CouplingReport } {
  const id = options.id ?? 'coupling', row = rowOf(rowIn, 'coupling'), [d1, d2] = row.boreMM, L = row.lengthMM, s = row.boreStepMM ?? L / 2, Ro = row.outsideMM / 2;
  const segs: { kind: 'line'; start: V2; tag: string }[] = [{ kind: 'line', start: [d1 / 2, 0], tag: 'face0' }, { kind: 'line', start: [Ro, 0], tag: 'outside' }, { kind: 'line', start: [Ro, L], tag: 'face1' }];
  if (d1 === d2) segs.push({ kind: 'line', start: [d2 / 2, L], tag: 'bore1' });
  else segs.push({ kind: 'line', start: [d2 / 2, L], tag: 'bore2' }, { kind: 'line', start: [d2 / 2, s], tag: 'step' }, { kind: 'line', start: [d1 / 2, s], tag: 'bore1' });
  return { brep: revolved(id, segs), report: { generator: 'coupling@0', row: row.id, ...(row.type ? { type: row.type } : {}), estimate: row.estimate === true, ...(row.source ? { source: row.source } : {}), boreMM: [d1, d2], outsideMM: row.outsideMM, lengthMM: L, boreStepMM: s,
    bought: { bought: true, ...(row.partNumber ? { partNumber: row.partNumber } : {}), ...(row.supplier ? { supplier: row.supplier } : {}), ...(row.source ? { source: row.source } : {}) }, envelopeOnly: true } };
}
