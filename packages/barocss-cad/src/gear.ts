// R6a (owner issue #2167, D53): the involute spur gear — its first stage (GEAR-01/02): external, parallel axes,
// straight teeth, pressure angle 20°, no profile shift. Dimensions, the tooth profile and the solid; diagnostics for
// what this stage does not do, never an approximation passed off silently.
//
// Formulas (textbook involute geometry; the issue cites KHK's technical reference, §4.1 and backlash §6.3, as its
// provenance): d = m z, db = d cos α, da = d + 2m, df = d − 2.5m; the reference tooth thickness s = πm/2 less the
// gear's thickness reduction; the involute X(t) = rb(cos t + t sin t), Y(t) = rb(sin t − t cos t) for the roll t ≥ 0,
// its polar angle inv φ = tan φ − φ at the radius r = rb / cos φ; the half thickness at r is
// ψ(r) = s / d + inv α − inv φ(r).
//
// The flanks are cubic B-splines fitted to the involute (C¹ Hermite pieces on the roll), as few pieces as the profile
// tolerance asks (at most five: a side face's 16 poles), the largest deviation measured and reported. The involute is
// not carried below the base circle: when the root circle lies under it, a radial line joins them — a schematic root,
// not the tool's (ROOT_TRANSITION_UNVALIDATED; manufacturingValidated false).
import { buildBrep, type Brep, type BrepFaceInput } from './brep-core.js';
import type { Curve, Point, Surface } from './types.js';

export type GearDiagnosticCode = 'INVALID_INPUT' | 'UNSUPPORTED_PROFILE_SHIFT' | 'UNSUPPORTED_GEAR_KIND' | 'PROFILE_BUDGET_EXCEEDED' | 'SELF_INTERSECTION' | 'ROOT_TRANSITION_UNVALIDATED' | 'BORE_INTERSECTION' | 'MATE_INCOMPATIBLE';
export interface GearDiagnostic { readonly code: GearDiagnosticCode; readonly severity: 'error' | 'warning'; readonly message: string }
export class GearError extends Error {
  constructor(readonly code: GearDiagnosticCode, detail: string) { super(`gear: ${detail}`); this.name = 'GearError'; }
}

/** Version 0 of the spur gear's inputs (lengths in mm). */
export interface SpurGearSpec {
  readonly moduleMM: number;
  readonly teeth: number;
  /** The reference pressure angle; 20° only in this stage. */
  readonly pressureAngleDeg?: number;
  readonly faceWidthMM: number;
  /** 0 only in this stage (UNSUPPORTED_PROFILE_SHIFT otherwise). */
  readonly profileShiftCoefficient?: number;
  /** 0: no bore. */
  readonly boreDiameterMM?: number;
  /** This gear's circumferential tooth thickness taken off at the reference circle (its share of a pair's backlash). */
  readonly toothThicknessReductionMM?: number;
  /** How the root joins the flanks; 'schematic-radial' only in this stage. */
  readonly rootPolicy?: 'schematic-radial';
  /** The largest deviation of a fitted flank from the involute; default 1e-4 m. */
  readonly profileToleranceMM?: number;
  /** The least rim left round a bore, below the root circle; default 1 m (geometry only: not a strength check). */
  readonly minimumRimMM?: number;
}
export interface SpurGearDimensions {
  readonly referenceDiameterMM: number; readonly baseDiameterMM: number; readonly tipDiameterMM: number; readonly rootDiameterMM: number;
  readonly circularPitchMM: number; readonly toothThicknessMM: number; readonly tipThicknessMM: number;
}
export interface SpurGearReport {
  readonly generator: 'spur-gear@0';
  readonly dimensions: SpurGearDimensions;
  /** Cubic pieces in each flank, and the largest measured deviation of a flank from the involute (mm). */
  readonly flankPieces: number; readonly profileDeviationMM: number; readonly profileToleranceMM: number;
  readonly rootPolicy: 'schematic-radial'; readonly manufacturingValidated: false;
  readonly diagnostics: readonly GearDiagnostic[];
}

/** A curve of the profile in the plane (z 0): its role, the tooth it belongs to (1-based) and its curve. */
interface Piece { readonly role: 'flankL' | 'flankR' | 'tip' | 'root' | 'rootL' | 'rootR' | 'bore'; readonly tooth: number; readonly curve: Curve }

const MAX_PIECES = 5, MAX_TEETH = 200;
const inv = (phi: number) => Math.tan(phi) - phi;

/** The gear's dimensions and the checks of this stage's inputs (refusals thrown, as GearError). */
export function spurGearDimensions(spec: SpurGearSpec): SpurGearDimensions & { alpha: number; rb: number; ra: number; rf: number; r: number; psi: number } {
  const m = spec.moduleMM, z = spec.teeth, b = spec.faceWidthMM;
  if (!(Number.isFinite(m) && m > 0 && m <= 100)) throw new GearError('INVALID_INPUT', 'moduleMM must be a number of mm above 0, at most 100');
  if (!(Number.isInteger(z) && z >= 1)) throw new GearError('INVALID_INPUT', 'teeth must be a whole number');
  if (!(Number.isFinite(b) && b > 0 && b <= 10000)) throw new GearError('INVALID_INPUT', 'faceWidthMM must be a number of mm above 0');
  const alphaDeg = spec.pressureAngleDeg ?? 20;
  if (alphaDeg !== 20) throw new GearError('UNSUPPORTED_GEAR_KIND', `pressure angle ${alphaDeg}°: only 20° in this stage`);
  const x = spec.profileShiftCoefficient ?? 0;
  if (!Number.isFinite(x)) throw new GearError('INVALID_INPUT', 'profileShiftCoefficient must be a number');
  if (x !== 0) throw new GearError('UNSUPPORTED_PROFILE_SHIFT', `profile shift ${x}: only 0 in this stage (shifted profiles arrive with R6a.5)`);
  const alpha = alphaDeg * Math.PI / 180;
  // Undercut: the basic rack's addendum line cuts below the base circle under z = 2 / sin²α (about 17.1 at 20°).
  const zMin = 2 / Math.sin(alpha) ** 2;
  if (z < zMin) throw new GearError('UNSUPPORTED_PROFILE_SHIFT', `${z} teeth at 20° without profile shift are undercut (below ${zMin.toFixed(1)}): a shift of at least x = ${(1 - z / zMin).toFixed(3)} would avoid it (shifted profiles arrive with R6a.5)`);
  if (z > MAX_TEETH) throw new GearError('INVALID_INPUT', `teeth at most ${MAX_TEETH} in this stage`);
  const d = m * z, r = d / 2, rb = r * Math.cos(alpha), ra = r + m, rf = r - 1.25 * m;
  const red = spec.toothThicknessReductionMM ?? 0;
  if (!(Number.isFinite(red) && red >= 0)) throw new GearError('INVALID_INPUT', 'toothThicknessReductionMM must be a number of mm, 0 or more');
  const s = Math.PI * m / 2 - red;
  if (!(s > 0)) throw new GearError('INVALID_INPUT', `a thickness reduction of ${red} mm leaves no tooth (the reference thickness is ${(Math.PI * m / 2).toFixed(4)} mm)`);
  const psi = s / d + inv(alpha), tipHalf = psi - inv(Math.acos(rb / ra));
  if (!(tipHalf > 0)) throw new GearError('SELF_INTERSECTION', 'the tooth comes to a point below its tip circle');
  return { referenceDiameterMM: d, baseDiameterMM: 2 * rb, tipDiameterMM: 2 * ra, rootDiameterMM: 2 * rf, circularPitchMM: Math.PI * m, toothThicknessMM: s, tipThicknessMM: 2 * ra * tipHalf, alpha, rb, ra, rf, r, psi };
}

/** The involute point at roll t (from the base circle at angle 0, unwinding counter-clockwise) and its derivative. */
const involute = (rb: number, t: number): [number, number] => [rb * (Math.cos(t) + t * Math.sin(t)), rb * (Math.sin(t) - t * Math.cos(t))];
const involuteD = (rb: number, t: number): [number, number] => [rb * t * Math.cos(t), rb * t * Math.sin(t)];

/**
 * One flank's Bézier control points (3N + 1, z 0) in the tooth's frame, over the roll t0 → t1, N C¹ Hermite pieces:
 * the involute turned by `turn`, mirrored in its x axis first when `mirror`.
 */
function flankPoles(rb: number, t0: number, t1: number, N: number, turn: number, mirror: boolean): Point[] {
  const c = Math.cos(turn), s = Math.sin(turn), out: Point[] = [];
  const put = (p: [number, number]) => { const y = mirror ? -p[1] : p[1]; out.push([c * p[0] - s * y, s * p[0] + c * y, 0]); };
  for (let k = 0; k < N; k++) {
    const ta = t0 + (t1 - t0) * k / N, tb = t0 + (t1 - t0) * (k + 1) / N, h = tb - ta, P0 = involute(rb, ta), P3 = involute(rb, tb), D0 = involuteD(rb, ta), D3 = involuteD(rb, tb);
    if (k === 0) put(P0);
    put([P0[0] + h / 3 * D0[0], P0[1] + h / 3 * D0[1]]); put([P3[0] - h / 3 * D3[0], P3[1] - h / 3 * D3[1]]); put(P3);
  }
  return out;
}
/** The largest distance of a Hermite-fitted involute (N pieces, unturned) from the involute: along the circle at each radius (a bound). */
function flankDeviation(rb: number, t0: number, t1: number, N: number): number {
  const P = flankPoles(rb, t0, t1, N, 0, false);
  let worst = 0;
  for (let k = 0; k < N; k++) for (let i = 0; i <= 64; i++) {
    const s = i / 64, u = 1 - s, a = P[3 * k], b = P[3 * k + 1], c = P[3 * k + 2], d = P[3 * k + 3];
    const x = u * u * u * a[0] + 3 * u * u * s * b[0] + 3 * u * s * s * c[0] + s * s * s * d[0], y = u * u * u * a[1] + 3 * u * u * s * b[1] + 3 * u * s * s * c[1] + s * s * s * d[1];
    const rho = Math.hypot(x, y), t = Math.sqrt(Math.max(0, (rho / rb) ** 2 - 1)), q = involute(rb, t);
    let da = Math.atan2(y, x) - Math.atan2(q[1], q[0]); if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    worst = Math.max(worst, Math.abs(da) * rho);
  }
  return worst;
}
const bezierKnots = (N: number) => { const k = [0, 0, 0, 0]; for (let i = 1; i < N; i++) k.push(i, i, i); k.push(N, N, N, N); return k; };
const lineCurve = (id: string, a: Point, b: Point): Curve => ({ kind: 'curve', id, degree: 1, knots: [0, 0, 1, 1], controlPoints: [a, b], weights: [1, 1] });
/** A circular arc about the origin, radius r, from angle a0 counter-clockwise by sweep (> 0; spans of at most 90°), or clockwise when sweep < 0. */
function arcCurve(id: string, r: number, a0: number, sweep: number): Curve {
  const spans = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-12)), dt = sweep / spans, w = Math.cos(Math.abs(dt) / 2);
  const cp: Point[] = [], wt: number[] = [], knots = [0, 0, 0];
  for (let k = 0; k < spans; k++) {
    const t0 = a0 + dt * k, tm = t0 + dt / 2, t1 = t0 + dt;
    if (k === 0) { cp.push([r * Math.cos(t0), r * Math.sin(t0), 0]); wt.push(1); }
    cp.push([r / w * Math.cos(tm), r / w * Math.sin(tm), 0]); wt.push(w);
    cp.push([r * Math.cos(t1), r * Math.sin(t1), 0]); wt.push(1);
    if (k < spans - 1) knots.push((k + 1) / spans, (k + 1) / spans);
  }
  knots.push(1, 1, 1);
  return { kind: 'curve', id, degree: 2, knots, controlPoints: cp, weights: wt };
}
const reversed = (c: Curve): Curve => ({ ...c, controlPoints: [...c.controlPoints].reverse(), weights: [...c.weights].reverse(), knots: c.knots.map(k => c.knots[0] + c.knots[c.knots.length - 1] - k).reverse() });

/** The gear's profile: its curves counter-clockwise round the gear (the bore's clockwise), and its report. */
export function spurGearProfile(spec: SpurGearSpec): { pieces: Piece[]; bore: Piece[]; report: SpurGearReport } {
  const g = spurGearDimensions(spec), m = spec.moduleMM, z = spec.teeth;
  if (spec.rootPolicy !== undefined && spec.rootPolicy !== 'schematic-radial') throw new GearError('INVALID_INPUT', `root policy ${String(spec.rootPolicy)}: only 'schematic-radial' in this stage`);
  const tol = spec.profileToleranceMM ?? 1e-4 * m;
  if (!(Number.isFinite(tol) && tol > 0)) throw new GearError('INVALID_INPUT', 'profileToleranceMM must be a number of mm above 0');
  const r0 = Math.max(g.rb, g.rf), t0 = Math.sqrt(Math.max(0, (r0 / g.rb) ** 2 - 1)), t1 = Math.sqrt((g.ra / g.rb) ** 2 - 1);
  // As few pieces as the tolerance asks; past the budget, refused (never a looser tolerance).
  let N = 1, deviation = flankDeviation(g.rb, t0, t1, 1);
  while (deviation > tol && N < MAX_PIECES) deviation = flankDeviation(g.rb, t0, t1, ++N);
  if (deviation > tol) throw new GearError('PROFILE_BUDGET_EXCEEDED', `a flank within ${tol} mm of the involute needs more than ${MAX_PIECES} cubic pieces (${MAX_PIECES} come to ${deviation.toExponential(2)} mm)`);
  // Half thickness at r0, at the tip; the flanks' turns: the left flank (lower angle) is the involute turned to
  // γ − ψ(rb), the right its mirror turned to γ + ψ(rb) (ψ(rb) = s/d + inv α: the involute starts at the base circle).
  const psiBase = g.psi, psiStart = g.psi - inv(Math.acos(g.rb / r0)), psiTip = g.psi - inv(Math.acos(g.rb / g.ra));
  const radial = g.rf < g.rb, pieces: Piece[] = [], step = 2 * Math.PI / z;
  if (!(step - 2 * psiStart > 1e-9)) throw new GearError('SELF_INTERSECTION', 'neighbouring teeth meet at the root');
  for (let k = 0; k < z; k++) {
    const gam = step * k, n = k + 1;
    if (radial) pieces.push({ role: 'rootL', tooth: n, curve: lineCurve('l', [g.rf * Math.cos(gam - psiBase), g.rf * Math.sin(gam - psiBase), 0], [g.rb * Math.cos(gam - psiBase), g.rb * Math.sin(gam - psiBase), 0]) });
    const L = flankPoles(g.rb, t0, t1, N, gam - psiBase, false), R = flankPoles(g.rb, t0, t1, N, gam + psiBase, true);
    pieces.push({ role: 'flankL', tooth: n, curve: { kind: 'curve', id: 'f', degree: 3, knots: bezierKnots(N), controlPoints: L, weights: L.map(() => 1) } });
    pieces.push({ role: 'tip', tooth: n, curve: arcCurve('t', g.ra, gam - psiTip, 2 * psiTip) });
    pieces.push({ role: 'flankR', tooth: n, curve: reversed({ kind: 'curve', id: 'f', degree: 3, knots: bezierKnots(N), controlPoints: R, weights: R.map(() => 1) }) });
    if (radial) pieces.push({ role: 'rootR', tooth: n, curve: lineCurve('l', [g.rb * Math.cos(gam + psiBase), g.rb * Math.sin(gam + psiBase), 0], [g.rf * Math.cos(gam + psiBase), g.rf * Math.sin(gam + psiBase), 0]) });
    pieces.push({ role: 'root', tooth: n, curve: arcCurve('r', g.rf, gam + psiStart, step - 2 * psiStart) });
  }
  // The bore: two half circles clockwise (a hole in the face).
  const bd = spec.boreDiameterMM ?? 0, rim = spec.minimumRimMM ?? m, bore: Piece[] = [];
  if (!(Number.isFinite(bd) && bd >= 0)) throw new GearError('INVALID_INPUT', 'boreDiameterMM must be a number of mm, 0 or more');
  if (bd > 0) {
    if (!(bd / 2 <= g.rf - rim)) throw new GearError('BORE_INTERSECTION', `a bore of ${bd} mm leaves less than the ${rim} mm rim below the root circle (Ø${(2 * g.rf).toFixed(3)} mm): at most Ø${(2 * (g.rf - rim)).toFixed(3)} (a geometric margin, not a strength check)`);
    bore.push({ role: 'bore', tooth: 1, curve: arcCurve('b', bd / 2, 0, -Math.PI) }, { role: 'bore', tooth: 2, curve: arcCurve('b', bd / 2, -Math.PI, -Math.PI) });
  }
  const diagnostics: GearDiagnostic[] = [{ code: 'ROOT_TRANSITION_UNVALIDATED', severity: 'warning', message: radial ? 'the root joins the flanks by radial lines from the base circle and a root arc: a schematic root, not the one the cutting tool generates' : 'the flanks meet the root arc at a corner: a schematic root, not the one the cutting tool generates' }];
  const dims: SpurGearDimensions = { referenceDiameterMM: g.referenceDiameterMM, baseDiameterMM: g.baseDiameterMM, tipDiameterMM: g.tipDiameterMM, rootDiameterMM: g.rootDiameterMM, circularPitchMM: g.circularPitchMM, toothThicknessMM: g.toothThicknessMM, tipThicknessMM: g.tipThicknessMM };
  return { pieces, bore, report: { generator: 'spur-gear@0', dimensions: dims, flankPieces: N, profileDeviationMM: deviation, profileToleranceMM: tol, rootPolicy: 'schematic-radial', manufacturingValidated: false, diagnostics } };
}

const moved = (c: Curve, z: number, id: string): Curve => ({ ...c, id, controlPoints: c.controlPoints.map(p => [p[0], p[1], z] as Point) });
const extruded = (c: Curve, z0: number, z1: number, id: string): Surface => ({ kind: 'surface', id, degreeU: c.degree, degreeV: 1, knotsU: [...c.knots], knotsV: [0, 0, 1, 1], controlPoints: c.controlPoints.map(p => [[p[0], p[1], z0], [p[0], p[1], z1]] as Point[]), weights: c.weights.map(w => [w, w]) });

/**
 * The gear as a solid: its profile pulled from z 0 through the face width, the bore through it. Faces `<id>.flankL#k`
 * and `.flankR#k` (tooth k's flanks), `.tip#k`, `.root#k` (the root arc after tooth k), `.rootL#k`/`.rootR#k` (the
 * schematic radial joins), `.face0`/`.face1` (z 0 / the far face), `.bore#1`/`#2`.
 */
export function spurGear(spec: SpurGearSpec, options: { readonly id?: string } = {}): { brep: Brep; report: SpurGearReport } {
  const id = (options.id ?? 'gear').replace(/[^A-Za-z0-9_-]/g, '_').replace(/^(?=[^A-Za-z_])/, '_');
  const { pieces, bore, report } = spurGearProfile(spec), z0 = 0, z1 = spec.faceWidthMM;
  const vertices: { id: string; point: Point }[] = [], edges: { id: string; curve: Curve; vertices: [string, string] }[] = [], faces: BrepFaceInput[] = [];
  const nameOf = (p: Piece) => p.role === 'bore' ? `${id}.bore#${p.tooth}` : `${id}.${p.role}#${p.tooth}`;
  /** One closed loop's side faces and its edges at both ends; the loops' uses for the two end faces. */
  const ring = (list: Piece[], tag: string) => {
    const n = list.length, bottom: string[] = [], top: string[] = [];
    list.forEach((p, i) => { const s = p.curve.controlPoints[0]; vertices.push({ id: `${id}_${tag}${i}b`, point: [s[0], s[1], z0] }, { id: `${id}_${tag}${i}t`, point: [s[0], s[1], z1] }); });
    list.forEach((p, i) => {
      const j = (i + 1) % n;
      edges.push({ id: `${id}_${tag}${i}eb`, curve: moved(p.curve, z0, `${id}_${tag}${i}cb`), vertices: [`${id}_${tag}${i}b`, `${id}_${tag}${j}b`] });
      edges.push({ id: `${id}_${tag}${i}et`, curve: moved(p.curve, z1, `${id}_${tag}${i}ct`), vertices: [`${id}_${tag}${i}t`, `${id}_${tag}${j}t`] });
      const s = p.curve.controlPoints[0];
      edges.push({ id: `${id}_${tag}${i}ev`, curve: lineCurveAt(`${id}_${tag}${i}cv`, [s[0], s[1], z0], [s[0], s[1], z1]), vertices: [`${id}_${tag}${i}b`, `${id}_${tag}${i}t`] });
      bottom.push(`${id}_${tag}${i}eb`); top.push(`${id}_${tag}${i}et`);
      const name = nameOf(p);
      faces.push({ id: `${id}_${tag}f${i}`, name, surface: extruded(p.curve, z0, z1, `${id}_${tag}s${i}`), sense: 'forward',
        loops: [{ kind: 'outer', uses: [{ edge: `${id}_${tag}${i}eb`, sense: 'forward' }, { edge: `${id}_${tag}${j}ev`, sense: 'forward' }, { edge: `${id}_${tag}${i}et`, sense: 'reversed' }, { edge: `${id}_${tag}${i}ev`, sense: 'reversed' }] }] });
    });
    return { bottom, top };
  };
  const outer = ring(pieces, 'o'), hole = bore.length ? ring(bore, 'h') : null;
  const R = report.dimensions.tipDiameterMM / 2 + 1, plane = (z: number, up: boolean, sid: string): Surface => ({ kind: 'surface', id: sid, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
    controlPoints: up ? [[[-R, -R, z], [-R, R, z]], [[R, -R, z], [R, R, z]]] : [[[-R, -R, z], [R, -R, z]], [[-R, R, z], [R, R, z]]], weights: [[1, 1], [1, 1]] });
  const loops = (uses: string[], up: boolean) => up ? uses.map(edge => ({ edge, sense: 'forward' as const })) : [...uses].reverse().map(edge => ({ edge, sense: 'reversed' as const }));
  faces.push({ id: `${id}_face0`, name: `${id}.face0`, surface: plane(z0, false, `${id}_p0`), sense: 'forward', loops: [{ kind: 'outer', uses: loops(outer.bottom, false) }, ...(hole ? [{ kind: 'inner' as const, uses: loops(hole.bottom, false) }] : [])] });
  faces.push({ id: `${id}_face1`, name: `${id}.face1`, surface: plane(z1, true, `${id}_p1`), sense: 'forward', loops: [{ kind: 'outer', uses: loops(outer.top, true) }, ...(hole ? [{ kind: 'inner' as const, uses: loops(hole.top, true) }] : [])] });
  const brep = buildBrep({ source: { family: 'gear', id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_shell`, faces, closed: true }] }] });
  return { brep, report };
}
const lineCurveAt = (id: string, a: Point, b: Point): Curve => ({ kind: 'curve', id, degree: 1, knots: [0, 0, 1, 1], controlPoints: [a, b], weights: [1, 1] });

/**
 * A pair's nominal values from the formulas alone (issue #2167 §6): the same module and pressure angle (else
 * MATE_INCOMPATIBLE), centre distance a = m(z1 + z2)/2, the speed ratio −z1/z2, the ideal transverse contact ratio
 * εα = [√(ra1² − rb1²) + √(ra2² − rb2²) − a sin α] / (π m cos α), and the backlash at that centre distance, the sum of
 * the two gears' thickness reductions. Not the pair checks (R6a.4: phase, clearance over a rotation, the usable flank).
 */
export function spurGearPairNominal(g1: SpurGearSpec, g2: SpurGearSpec): { centerDistanceMM: number; speedRatio: number; idealContactRatio: number; backlashMM: number } {
  const a1 = spurGearDimensions(g1), a2 = spurGearDimensions(g2);
  if (g1.moduleMM !== g2.moduleMM) throw new GearError('MATE_INCOMPATIBLE', `modules ${g1.moduleMM} and ${g2.moduleMM} mm do not mesh`);
  if (a1.alpha !== a2.alpha) throw new GearError('MATE_INCOMPATIBLE', 'pressure angles differ');
  const m = g1.moduleMM, a = m * (g1.teeth + g2.teeth) / 2, alpha = a1.alpha;
  const eps = (Math.sqrt(a1.ra ** 2 - a1.rb ** 2) + Math.sqrt(a2.ra ** 2 - a2.rb ** 2) - a * Math.sin(alpha)) / (Math.PI * m * Math.cos(alpha));
  return { centerDistanceMM: a, speedRatio: -g1.teeth / g2.teeth, idealContactRatio: eps, backlashMM: (g1.toothThicknessReductionMM ?? 0) + (g2.toothThicknessReductionMM ?? 0) };
}
