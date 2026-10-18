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
  /** x, the cutting rack moved out by x m (R6a.5, D57): from −0.5 to 1 (UNSUPPORTED_PROFILE_SHIFT otherwise). */
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
  /** The profile shift coefficient x it was cut with (0: none). */
  readonly profileShift: number;
  /** Cubic pieces in each flank, and the largest measured deviation of a flank from the involute (mm). */
  readonly flankPieces: number; readonly profileDeviationMM: number; readonly profileToleranceMM: number;
  readonly rootPolicy: 'schematic-radial'; readonly manufacturingValidated: false;
  readonly diagnostics: readonly GearDiagnostic[];
}

/** A curve of the profile in the plane (z 0): its role, the tooth it belongs to (1-based) and its curve. */
interface Piece { readonly role: 'flankL' | 'flankR' | 'tip' | 'root' | 'rootL' | 'rootR' | 'bore'; readonly tooth: number; readonly curve: Curve }

const MAX_PIECES = 5, MAX_TEETH = 200, MIN_SHIFT = -0.5, MAX_SHIFT = 1;
export const inv = (phi: number) => Math.tan(phi) - phi;

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
  if (!(x >= MIN_SHIFT && x <= MAX_SHIFT)) throw new GearError('UNSUPPORTED_PROFILE_SHIFT', `profile shift ${x}: from ${MIN_SHIFT} to ${MAX_SHIFT} in this stage`);
  const alpha = alphaDeg * Math.PI / 180;
  // Undercut: the basic rack's addendum line, moved out by x m, cuts below the base circle under z = 2(1 − x)/sin²α
  // (about 17.1 at 20° unshifted).
  const zMin = 2 * (1 - x) / Math.sin(alpha) ** 2;
  if (z < zMin) throw new GearError('UNSUPPORTED_PROFILE_SHIFT', `${z} teeth at 20°${x ? ` with x = ${x}` : ' without profile shift'} are undercut (below ${zMin.toFixed(1)}): a shift of at least x = ${(1 - z * Math.sin(alpha) ** 2 / 2).toFixed(3)} would avoid it`);
  if (z > MAX_TEETH) throw new GearError('INVALID_INPUT', `teeth at most ${MAX_TEETH} in this stage`);
  // The shifted gear cut by the standard rack (addendum m, dedendum 1.25 m) moved out by x m: tip and root move out by
  // x m, the reference tooth thickens by 2 x m tan α. (No tip shortening: that depends on the mate; the pair checks
  // report the tip clearances.)
  const d = m * z, r = d / 2, rb = r * Math.cos(alpha), ra = r + m * (1 + x), rf = r - m * (1.25 - x);
  const red = spec.toothThicknessReductionMM ?? 0;
  if (!(Number.isFinite(red) && red >= 0)) throw new GearError('INVALID_INPUT', 'toothThicknessReductionMM must be a number of mm, 0 or more');
  const s0 = m * (Math.PI / 2 + 2 * x * Math.tan(alpha)), s = s0 - red;
  if (!(s > 0)) throw new GearError('INVALID_INPUT', `a thickness reduction of ${red} mm leaves no tooth (the reference thickness is ${s0.toFixed(4)} mm)`);
  const psi = s / d + inv(alpha), tipHalf = psi - inv(Math.acos(rb / ra));
  if (!(tipHalf > 0)) throw new GearError('SELF_INTERSECTION', `the tooth comes to a point below its tip circle${x > 0 ? ` (a shift of ${x} on ${z} teeth)` : ''}`);
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
export const lineCurve = (id: string, a: Point, b: Point): Curve => ({ kind: 'curve', id, degree: 1, knots: [0, 0, 1, 1], controlPoints: [a, b], weights: [1, 1] });
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
  return { pieces, bore, report: { generator: 'spur-gear@0', dimensions: dims, profileShift: spec.profileShiftCoefficient ?? 0, flankPieces: N, profileDeviationMM: deviation, profileToleranceMM: tol, rootPolicy: 'schematic-radial', manufacturingValidated: false, diagnostics } };
}

const moved = (c: Curve, z: number, id: string): Curve => ({ ...c, id, controlPoints: c.controlPoints.map(p => [p[0], p[1], z] as Point) });
const extruded = (c: Curve, z0: number, z1: number, id: string): Surface => ({ kind: 'surface', id, degreeU: c.degree, degreeV: 1, knotsU: [...c.knots], knotsV: [0, 0, 1, 1], controlPoints: c.controlPoints.map(p => [[p[0], p[1], z0], [p[0], p[1], z1]] as Point[]), weights: c.weights.map(w => [w, w]) });

/**
 * The gear as a solid: its profile pulled from z 0 through the face width, the bore through it. Faces `<id>.flankL#k`
 * and `.flankR#k` (tooth k's flanks), `.tip#k`, `.root#k` (the root arc after tooth k), `.rootL#k`/`.rootR#k` (the
 * schematic radial joins), `.face0`/`.face1` (z 0 / the far face), `.bore#1`/`#2`.
 */
export function spurGear(spec: SpurGearSpec, options: { readonly id?: string } = {}): { brep: Brep; report: SpurGearReport } {
  const id = safeId(options.id ?? 'gear');
  const { pieces, bore, report } = spurGearProfile(spec);
  const nameOf = (p: Piece) => p.role === 'bore' ? `${id}.bore#${p.tooth}` : `${id}.${p.role}#${p.tooth}`;
  const brep = extrudedProfile(id, 'gear', pieces.map(p => ({ name: nameOf(p), curve: p.curve })), bore.map(p => ({ name: nameOf(p), curve: p.curve })), spec.faceWidthMM, report.dimensions.tipDiameterMM / 2 + 1);
  return { brep, report };
}
/** A feature id made safe for B-rep entity ids. */
export const safeId = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, '_').replace(/^(?=[^A-Za-z_])/, '_');

/**
 * A closed plane profile (z 0; its curves counter-clockwise, a hole's clockwise) pulled from z 0 through `depth`:
 * each curve a side face of its name, `<id>.face0`/`.face1` the end faces (their planes reaching `R` about the origin).
 */
export function extrudedProfile(id: string, family: string, outerPieces: readonly { name: string; curve: Curve }[], innerPieces: readonly { name: string; curve: Curve }[], depth: number, R: number): Brep {
  const z0 = 0, z1 = depth;
  const vertices: { id: string; point: Point }[] = [], edges: { id: string; curve: Curve; vertices: [string, string] }[] = [], faces: BrepFaceInput[] = [];
  /** One closed loop's side faces and its edges at both ends; the loops' uses for the two end faces. */
  const ring = (list: readonly { name: string; curve: Curve }[], tag: string) => {
    const n = list.length, bottom: string[] = [], top: string[] = [];
    list.forEach((p, i) => { const s = p.curve.controlPoints[0]; vertices.push({ id: `${id}_${tag}${i}b`, point: [s[0], s[1], z0] }, { id: `${id}_${tag}${i}t`, point: [s[0], s[1], z1] }); });
    list.forEach((p, i) => {
      const j = (i + 1) % n;
      edges.push({ id: `${id}_${tag}${i}eb`, curve: moved(p.curve, z0, `${id}_${tag}${i}cb`), vertices: [`${id}_${tag}${i}b`, `${id}_${tag}${j}b`] });
      edges.push({ id: `${id}_${tag}${i}et`, curve: moved(p.curve, z1, `${id}_${tag}${i}ct`), vertices: [`${id}_${tag}${i}t`, `${id}_${tag}${j}t`] });
      const s = p.curve.controlPoints[0];
      edges.push({ id: `${id}_${tag}${i}ev`, curve: lineCurveAt(`${id}_${tag}${i}cv`, [s[0], s[1], z0], [s[0], s[1], z1]), vertices: [`${id}_${tag}${i}b`, `${id}_${tag}${i}t`] });
      bottom.push(`${id}_${tag}${i}eb`); top.push(`${id}_${tag}${i}et`);
      faces.push({ id: `${id}_${tag}f${i}`, name: p.name, surface: extruded(p.curve, z0, z1, `${id}_${tag}s${i}`), sense: 'forward',
        loops: [{ kind: 'outer', uses: [{ edge: `${id}_${tag}${i}eb`, sense: 'forward' }, { edge: `${id}_${tag}${j}ev`, sense: 'forward' }, { edge: `${id}_${tag}${i}et`, sense: 'reversed' }, { edge: `${id}_${tag}${i}ev`, sense: 'reversed' }] }] });
    });
    return { bottom, top };
  };
  const outer = ring(outerPieces, 'o'), hole = innerPieces.length ? ring(innerPieces, 'h') : null;
  const plane = (z: number, up: boolean, sid: string): Surface => ({ kind: 'surface', id: sid, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
    controlPoints: up ? [[[-R, -R, z], [-R, R, z]], [[R, -R, z], [R, R, z]]] : [[[-R, -R, z], [R, -R, z]], [[-R, R, z], [R, R, z]]], weights: [[1, 1], [1, 1]] });
  const loops = (uses: string[], up: boolean) => up ? uses.map(edge => ({ edge, sense: 'forward' as const })) : [...uses].reverse().map(edge => ({ edge, sense: 'reversed' as const }));
  faces.push({ id: `${id}_face0`, name: `${id}.face0`, surface: plane(z0, false, `${id}_p0`), sense: 'forward', loops: [{ kind: 'outer', uses: loops(outer.bottom, false) }, ...(hole ? [{ kind: 'inner' as const, uses: loops(hole.bottom, false) }] : [])] });
  faces.push({ id: `${id}_face1`, name: `${id}.face1`, surface: plane(z1, true, `${id}_p1`), sense: 'forward', loops: [{ kind: 'outer', uses: loops(outer.top, true) }, ...(hole ? [{ kind: 'inner' as const, uses: loops(hole.top, true) }] : [])] });
  return buildBrep({ source: { family, id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_shell`, faces, closed: true }] }] });
}
const lineCurveAt = (id: string, a: Point, b: Point): Curve => ({ kind: 'curve', id, degree: 1, knots: [0, 0, 1, 1], controlPoints: [a, b], weights: [1, 1] });

/**
 * The pair's centre distance with no backlash (R6a.5, D57): unshifted, m(z1 + z2)/2; shifted, a = m(z1 + z2) cos α /
 * (2 cos α_w), with inv α_w = inv α + 2 tan α (x1 + x2)/(z1 + z2) solved by Newton's method (inv is increasing).
 * (Thickness reductions are backlash, not a change of distance.)
 */
function workingDistance(g1: SpurGearSpec, g2: SpurGearSpec, alpha: number): number {
  const z1 = g1.teeth, z2 = g2.teeth, aRef = g1.moduleMM * (z1 + z2) / 2, sum = (g1.profileShiftCoefficient ?? 0) + (g2.profileShiftCoefficient ?? 0);
  if (sum === 0) return aRef;
  const target = inv(alpha) + 2 * Math.tan(alpha) * sum / (z1 + z2);
  if (!(target > 0)) throw new GearError('MATE_INCOMPATIBLE', `shifts summing to ${sum} on ${z1} + ${z2} teeth leave no working pressure angle`);
  let w = alpha;
  for (let i = 0; i < 50; i++) { const f = inv(w) - target, dw = f / (Math.tan(w) ** 2); w -= dw; if (!(w > 0 && w < Math.PI / 2)) throw new GearError('MATE_INCOMPATIBLE', 'no working pressure angle for these shifts'); if (Math.abs(dw) < 1e-15) break; }
  return aRef * Math.cos(alpha) / Math.cos(w);
}
/** The centre distance at which two spur gears mesh without backlash (shifted pairs: the working one). */
export function spurGearCenterDistance(g1: SpurGearSpec, g2: SpurGearSpec): number {
  const a1 = spurGearDimensions(g1), a2 = spurGearDimensions(g2);
  if (g1.moduleMM !== g2.moduleMM) throw new GearError('MATE_INCOMPATIBLE', `modules ${g1.moduleMM} and ${g2.moduleMM} mm do not mesh`);
  if (a1.alpha !== a2.alpha) throw new GearError('MATE_INCOMPATIBLE', 'pressure angles differ');
  return workingDistance(g1, g2, a1.alpha);
}

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
  const m = g1.moduleMM, a = workingDistance(g1, g2, a1.alpha), alpha = a1.alpha, alphaW = Math.acos(m * (g1.teeth + g2.teeth) / 2 * Math.cos(alpha) / a);
  const eps = (Math.sqrt(a1.ra ** 2 - a1.rb ** 2) + Math.sqrt(a2.ra ** 2 - a2.rb ** 2) - a * Math.sin(alphaW)) / (Math.PI * m * Math.cos(alpha));
  return { centerDistanceMM: a, speedRatio: -g1.teeth / g2.teeth, idealContactRatio: eps, backlashMM: (g1.toothThicknessReductionMM ?? 0) + (g2.toothThicknessReductionMM ?? 0) };
}

/** The pair check's options: the centre distance (default nominal), gear 2 turned off its meshing phase, the sweep. */
/**
 * The pair check's options: the centre distance (default nominal), gear 2 turned off its meshing phase, the sweep's
 * samples, and `mode` — 'report' (default: the least clearance refined, the depth of a crossing, the convergence
 * check) or 'verdict' (pass or fail: the sweep stops at the first sample whose teeth cross, no depth, one scan).
 */
export interface SpurGearPairOptions { readonly centerDistanceMM?: number; readonly relativePhaseDeg?: number; readonly samples?: number; readonly mode?: 'report' | 'verdict' }
export interface SpurGearPairCheck {
  readonly centerDistanceMM: number; readonly nominalCenterDistanceMM: number;
  readonly workingPressureAngleDeg: number; readonly workingPitchDiametersMM: readonly [number, number];
  /** Circumferential backlash at the working pitch circle, p_w − s_w1 − s_w2 (by the formula); negative: the teeth jam. */
  readonly backlashMM: number;
  /** a − ra1 − rf2 and a − ra2 − rf1. */
  readonly tipClearancesMM: readonly [number, number];
  /** The formula's (ideal tips, flanks down to the base circle), and the path of contact the usable flanks allow. */
  readonly idealContactRatio: number; readonly usableContactRatio: number;
  /** One tooth period swept (the configuration repeats), at `samples` then twice as many, the least clearance refined. */
  readonly sweep: { readonly samples: number; readonly minimumClearanceMM: number; readonly atDegrees: number; readonly interference: boolean; readonly converged: boolean; readonly coarseMinimumMM: number };
  readonly diagnostics: readonly GearDiagnostic[];
}

/**
 * The pair checks (R6a.4, issue #2167 §6): the same module and pressure angle (else MATE_INCOMPATIBLE); at the centre
 * distance a′ the working pressure angle α_w = acos(a cos α / a′), the working pitch circles a′z/(z1 + z2), the
 * backlash p_w − s_w1 − s_w2 and the tip clearances; the contact ratio from the usable flanks (r ≥ max(rb, rf), r ≤ ra
 * on each gear along the line of action) beside the ideal formula; and the two gears' exact profiles (the analytic
 * involute, densely) swept through one tooth period, the least clearance found and refined — interference where they
 * cross. A few frames are not proof: twice the samples must find the same least clearance (converged).
 */
export function checkSpurGearPair(g1: SpurGearSpec, g2: SpurGearSpec, options: SpurGearPairOptions = {}): SpurGearPairCheck {
  // (The same pair, distance, phase and sweep again: the result kept — panels and checks ask often.)
  const key = JSON.stringify([g1, g2, options.centerDistanceMM ?? null, options.relativePhaseDeg ?? 0, options.samples ?? 64, options.mode ?? 'report']);
  const kept = pairCache.get(key);
  if (kept) { pairCache.delete(key); pairCache.set(key, kept); return kept; }
  const out = pairCheck(g1, g2, options);
  pairCache.set(key, out); if (pairCache.size > 64) pairCache.delete(pairCache.keys().next().value!);
  return out;
}
const pairCache = new Map<string, SpurGearPairCheck>();
function pairCheck(g1: SpurGearSpec, g2: SpurGearSpec, options: SpurGearPairOptions): SpurGearPairCheck {
  const a1 = spurGearDimensions(g1), a2 = spurGearDimensions(g2);
  if (g1.moduleMM !== g2.moduleMM) throw new GearError('MATE_INCOMPATIBLE', `modules ${g1.moduleMM} and ${g2.moduleMM} mm do not mesh`);
  if (a1.alpha !== a2.alpha) throw new GearError('MATE_INCOMPATIBLE', 'pressure angles differ');
  const m = g1.moduleMM, z1 = g1.teeth, z2 = g2.teeth, alpha = a1.alpha, aRef = m * (z1 + z2) / 2, a0 = workingDistance(g1, g2, alpha), a = options.centerDistanceMM ?? a0;
  if (!(Number.isFinite(a) && a > 0)) throw new GearError('INVALID_INPUT', 'centerDistanceMM must be a number of mm above 0');
  const cw = aRef * Math.cos(alpha) / a;
  if (!(cw < 1)) throw new GearError('MATE_INCOMPATIBLE', `at ${a} mm the gears' base circles overlap: no working pressure angle`);
  const alphaW = Math.acos(cw), rw1 = a * z1 / (z1 + z2), rw2 = a * z2 / (z1 + z2);
  // Thickness at the working circle: s_w = 2 r_w (s/d + inv α − inv α_w); backlash p_w − s_w1 − s_w2.
  const sw = (g: typeof a1, rw: number) => 2 * rw * (g.psi - inv(alphaW)), pw = 2 * Math.PI * rw1 / z1;
  const backlash = pw - sw(a1, rw1) - sw(a2, rw2);
  const tips: [number, number] = [a - a1.ra - a2.rf, a - a2.ra - a1.rf];
  const ideal = (Math.sqrt(a1.ra ** 2 - a1.rb ** 2) + Math.sqrt(a2.ra ** 2 - a2.rb ** 2) - a * Math.sin(alphaW)) / (Math.PI * m * Math.cos(alpha));
  // The line of action, by its distance u from T1 (gear 1's base-circle tangent point): r1² = rb1² + u², r2² = rb2² + (L − u)².
  const L = a * Math.sin(alphaW), lo1 = Math.sqrt(Math.max(0, Math.max(a1.rb, a1.rf) ** 2 - a1.rb ** 2)), hi1 = Math.sqrt(a1.ra ** 2 - a1.rb ** 2);
  const lo2 = Math.sqrt(Math.max(0, Math.max(a2.rb, a2.rf) ** 2 - a2.rb ** 2)), hi2 = Math.sqrt(a2.ra ** 2 - a2.rb ** 2);
  const start = Math.max(lo1, L - hi2, 0), end = Math.min(hi1, L - lo2, L), usable = Math.max(0, end - start) / (Math.PI * m * Math.cos(alpha));
  // The sweep: gear 1 about the origin, gear 2 about (a, 0); gear 2 turned so a tooth space faces gear 1 (its teeth at
  // π − π/z2 + 2πk/z2), then by the phase given; as gear 1 turns by θ, gear 2 by −θ z1/z2.
  const P1 = exactProfile(g1, a1), P2 = exactProfile(g2, a2), phase = (options.relativePhaseDeg ?? 0) * Math.PI / 180, base2 = Math.PI - Math.PI / z2 + phase;
  const verdict = options.mode === 'verdict';
  const at = (theta: number) => profileClearance(P1, theta, P2, base2 - theta * z1 / z2, a, a1.ra, a2.ra, verdict);
  const period = 2 * Math.PI / z1, N = Math.max(16, options.samples ?? 64);
  if (verdict) {
    // Pass or fail: one scan, stopping at the first crossing.
    let least = Infinity, tAt = 0;
    for (let i = 0; i < N; i++) { const t = period * i / N, d = at(t); if (d < least) { least = d; tAt = t; } if (d < 0) break; }
    const crossed = least < 0, diagnostics: GearDiagnostic[] = crossed ? [{ code: 'SELF_INTERSECTION', severity: 'error', message: `the teeth cross at ${(tAt * 180 / Math.PI).toFixed(4)}° of gear 1 (the depth: a report)` }] : [];
    return { centerDistanceMM: a, nominalCenterDistanceMM: a0, workingPressureAngleDeg: alphaW * 180 / Math.PI, workingPitchDiametersMM: [2 * rw1, 2 * rw2], backlashMM: backlash, tipClearancesMM: tips,
      idealContactRatio: ideal, usableContactRatio: usable, sweep: { samples: N, minimumClearanceMM: crossed ? -0 : least, atDegrees: tAt * 180 / Math.PI, interference: crossed, converged: false, coarseMinimumMM: least }, diagnostics };
  }
  const scan = (n: number) => { let best = { d: Infinity, t: 0 }; for (let i = 0; i < n; i++) { const t = period * i / n, d = at(t); if (d < best.d) best = { d, t }; } return best; };
  const coarse = scan(N), fine = scan(2 * N), seed = fine.d < coarse.d ? fine : coarse;
  // Golden section about the least sample.
  let lo = seed.t - period / N, hi = seed.t + period / N, x1 = hi - 0.618033988749895 * (hi - lo), x2 = lo + 0.618033988749895 * (hi - lo), f1 = at(x1), f2 = at(x2);
  for (let it = 0; it < 60 && hi - lo > 1e-9; it++) { if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - 0.618033988749895 * (hi - lo); f1 = at(x1); } else { lo = x1; x1 = x2; f1 = f2; x2 = lo + 0.618033988749895 * (hi - lo); f2 = at(x2); } }
  const refined = Math.min(seed.d, f1, f2), tAt = f1 < f2 ? x1 : x2;
  const converged = Math.abs(coarse.d - fine.d) <= Math.max(1e-6 * m, 0.02 * Math.abs(refined));
  const diagnostics: GearDiagnostic[] = [];
  if (refined < 0) diagnostics.push({ code: 'SELF_INTERSECTION', severity: 'error', message: `the teeth cross by ${(-refined).toFixed(6)} mm at ${(tAt * 180 / Math.PI).toFixed(4)}° of gear 1` });
  if (!converged) diagnostics.push({ code: 'INVALID_INPUT', severity: 'warning', message: `the sweep did not settle (${N} samples: ${coarse.d.toExponential(3)}, ${2 * N}: ${fine.d.toExponential(3)} mm): more samples are needed` });
  if (usable + 1e-12 < ideal) diagnostics.push({ code: 'ROOT_TRANSITION_UNVALIDATED', severity: 'warning', message: `the usable flanks give a contact ratio of ${usable.toFixed(4)}, below the ideal ${ideal.toFixed(4)}` });
  return { centerDistanceMM: a, nominalCenterDistanceMM: a0, workingPressureAngleDeg: alphaW * 180 / Math.PI, workingPitchDiametersMM: [2 * rw1, 2 * rw2], backlashMM: backlash, tipClearancesMM: tips,
    idealContactRatio: ideal, usableContactRatio: usable, sweep: { samples: N, minimumClearanceMM: refined, atDegrees: tAt * 180 / Math.PI, interference: refined < 0, converged, coarseMinimumMM: coarse.d }, diagnostics };
}

/**
 * A gear's exact outline for the sweep, as one tooth (from root to root, centred on angle 0): the analytic involute at
 * 150 points a flank (chords within about 1e-5 m of it), the arcs at 24.
 */
export function exactProfile(spec: SpurGearSpec, g: ReturnType<typeof spurGearDimensions>): { tooth: Float64Array; z: number } {
  const r0 = Math.max(g.rb, g.rf), t0 = Math.sqrt(Math.max(0, (r0 / g.rb) ** 2 - 1)), t1 = Math.sqrt((g.ra / g.rb) ** 2 - 1), F = 150, A = 24, z = spec.teeth, step = 2 * Math.PI / z;
  const psiStart = g.psi - inv(Math.acos(g.rb / r0)), psiTip = g.psi - inv(Math.acos(g.rb / g.ra)), pts: number[] = [];
  const polar = (r: number, ang: number) => { pts.push(r * Math.cos(ang), r * Math.sin(ang)); };
  // Half the root arc before the tooth, the left flank, the tip, the right flank, half the root arc after.
  for (let i = 0; i <= A / 2; i++) polar(g.rf, -step / 2 + (step / 2 - psiStart) * i / (A / 2));
  if (g.rf < g.rb) polar(g.rb, -g.psi);
  for (let i = 0; i <= F; i++) { const t = t0 + (t1 - t0) * i / F, r = g.rb * Math.sqrt(1 + t * t); polar(r, -g.psi + t - Math.atan(t)); }
  for (let i = 1; i < A; i++) polar(g.ra, -psiTip + 2 * psiTip * i / A);
  for (let i = F; i >= 0; i--) { const t = t0 + (t1 - t0) * i / F, r = g.rb * Math.sqrt(1 + t * t); polar(r, g.psi - t + Math.atan(t)); }
  if (g.rf < g.rb) polar(g.rf, g.psi);
  for (let i = 0; i <= A / 2; i++) polar(g.rf, psiStart + (step / 2 - psiStart) * i / (A / 2));
  return { tooth: Float64Array.from(pts), z };
}
/**
 * The least distance between the two gears' outlines near the mesh (the teeth within three pitches of the line of
 * centres), negative when they cross (by the deepest point of one inside the other).
 */
function profileClearance(P1: { tooth: Float64Array; z: number }, th1: number, P2: { tooth: Float64Array; z: number }, th2: number, a: number, ra1: number, ra2: number, verdict = false): number {
  const A = teethNear(P1, th1, 0, 0, 0), B = teethNear(P2, th2, a, 0, Math.PI);
  // Each side's segments near the other gear (within its tip circle and a little), once.
  const sa = nearSegments(A, a, 0, ra2 + 1), sb = nearSegments(B, 0, 0, ra1 + 1);
  let best = Infinity, crossed = false;
  for (let i = 0; i < sa.length; i += 4) {
    const ax = sa[i], ay = sa[i + 1], bx = sa[i + 2], by = sa[i + 3];
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    for (let j = 0; j < sb.length; j += 4) {
      const cx = sb[j], cy = sb[j + 1], dx = sb[j + 2], dy = sb[j + 3];
      // (Boxes farther apart than the best so far: no nearer pair here, and no crossing.)
      const gx = Math.max(0, Math.min(cx, dx) - x1, x0 - Math.max(cx, dx)), gy = Math.max(0, Math.min(cy, dy) - y1, y0 - Math.max(cy, dy));
      if (gx * gx + gy * gy > best * best) continue;
      if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) { if (verdict) return -1; crossed = true; best = 0; continue; }
      best = Math.min(best, segmentDistance(ax, ay, bx, by, cx, cy, dx, dy));
    }
  }
  return crossed ? -depthInside(sa, sb, a, ra1, ra2) : best;
}
/** The segments (x0, y0, x1, y1 each) of the tooth runs with an end within `reach` of (cx, cy). */
export function nearSegments(runs: Float64Array[], cx: number, cy: number, reach: number): Float64Array {
  const out: number[] = [], r2 = reach * reach;
  for (const p of runs) for (let i = 0; i + 3 < p.length; i += 2) {
    const ax = p[i] - cx, ay = p[i + 1] - cy, bx = p[i + 2] - cx, by = p[i + 3] - cy;
    if (ax * ax + ay * ay > r2 && bx * bx + by * by > r2) continue;
    out.push(p[i], p[i + 1], p[i + 2], p[i + 3]);
  }
  return Float64Array.from(out);
}
/** The teeth of a gear turned by θ about (cx, cy) whose middles lie within three pitches of the direction `toward`. */
export function teethNear(P: { tooth: Float64Array; z: number }, theta: number, cx: number, cy: number, toward: number): Float64Array[] {
  const out: Float64Array[] = [], step = 2 * Math.PI / P.z;
  for (let k = 0; k < P.z; k++) {
    const ang = theta + step * k; let d = ang - toward; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    if (Math.abs(d) > 3 * step) continue;
    const c = Math.cos(ang), s = Math.sin(ang), t = P.tooth, q = new Float64Array(t.length);
    for (let i = 0; i < t.length; i += 2) { q[i] = cx + c * t[i] - s * t[i + 1]; q[i + 1] = cy + s * t[i] + c * t[i + 1]; }
    out.push(q);
  }
  return out;
}
export const orient = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
export function segmentsCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const d1 = orient(cx, cy, dx, dy, ax, ay), d2 = orient(cx, cy, dx, dy, bx, by), d3 = orient(ax, ay, bx, by, cx, cy), d4 = orient(ax, ay, bx, by, dx, dy);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
export function pointSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey, t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / l2)) : 0;
  return Math.hypot(px - ax - t * ex, py - ay - t * ey);
}
export function segmentDistance(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(pointSegment(ax, ay, cx, cy, dx, dy), pointSegment(bx, by, cx, cy, dx, dy), pointSegment(cx, cy, ax, ay, bx, by), pointSegment(dx, dy, ax, ay, bx, by));
}
/**
 * How deep the outlines' crossing goes: the largest distance of a point of one side's near segments inside the other
 * gear — on the left of the other outline's nearest segment (each tooth run goes counter-clockwise round its gear,
 * its material on the left).
 */
function depthInside(sa: Float64Array, sb: Float64Array, a: number, ra1: number, ra2: number): number {
  let deep = 0;
  for (const [X, Y, cx, ra] of [[sa, sb, a, ra2], [sb, sa, 0, ra1]] as const) for (let i = 0; i < X.length; i += 2) {
    const px = X[i], py = X[i + 1];
    // (Only a point within the other gear's tip circle can be inside it.)
    if ((px - cx) * (px - cx) + py * py >= ra * ra) continue;
    let d = Infinity, side = 0;
    for (let j = 0; j < Y.length; j += 4) {
      const gx = Math.max(0, Math.min(Y[j], Y[j + 2]) - px, px - Math.max(Y[j], Y[j + 2])), gy = Math.max(0, Math.min(Y[j + 1], Y[j + 3]) - py, py - Math.max(Y[j + 1], Y[j + 3]));
      if (gx * gx + gy * gy >= d * d) continue;
      const e = pointSegment(px, py, Y[j], Y[j + 1], Y[j + 2], Y[j + 3]); if (e < d) { d = e; side = orient(Y[j], Y[j + 1], Y[j + 2], Y[j + 3], px, py); }
    }
    if (side > 0 && d > deep) deep = d;
  }
  return deep;
}

/** A spur gear as it stands: axis along +Z through `center`, its faces from `from` to `from` + b, turned by `rotation` (radians). */
export interface PlacedSpurGear { readonly spec: SpurGearSpec; readonly center: readonly [number, number]; readonly from: number; readonly rotation: number }
export interface PlacedSpurGearPairCheck extends SpurGearPairCheck {
  /** The relative phase the gears stand at (degrees, in [0, 360/z2)), and how far their faces overlap along the axis. */
  readonly relativePhaseDeg: number;
  readonly faceOverlapMM: number;
}

/**
 * The pair checks for two gears as placed (R6a.4b, D56): the centre distance from their centres, the relative phase
 * from their turns (gear 2's turn on the line of centres, less the half-pitch offset, plus gear 1's carried through
 * the ratio, modulo gear 2's pitch angle), and the axial overlap of their faces — none is MATE_INCOMPATIBLE.
 */
export function checkPlacedSpurGears(g1: PlacedSpurGear, g2: PlacedSpurGear, options: Omit<SpurGearPairOptions, 'centerDistanceMM' | 'relativePhaseDeg'> = {}): PlacedSpurGearPairCheck {
  const dx = g2.center[0] - g1.center[0], dy = g2.center[1] - g1.center[1], a = Math.hypot(dx, dy);
  const overlap = Math.min(g1.from + g1.spec.faceWidthMM, g2.from + g2.spec.faceWidthMM) - Math.max(g1.from, g2.from);
  if (!(overlap > 0)) throw new GearError('MATE_INCOMPATIBLE', `the faces do not overlap along the axes (${overlap.toFixed(6)} mm)`);
  if (!(a > 0)) throw new GearError('MATE_INCOMPATIBLE', 'the gears share an axis');
  const phi = Math.atan2(dy, dx), z1 = g1.spec.teeth, z2 = g2.spec.teeth, pitch = 2 * Math.PI / z2;
  const raw = (g2.rotation - phi) - (Math.PI - Math.PI / z2) + (g1.rotation - phi) * z1 / z2;
  // (A phase within a rounding of a whole pitch is 0.)
  let phase = ((raw % pitch) + pitch) % pitch; if (phase < 1e-9 * pitch || pitch - phase < 1e-9 * pitch) phase = 0;
  const phaseDeg = phase * 180 / Math.PI;
  const check = checkSpurGearPair(g1.spec, g2.spec, { ...options, centerDistanceMM: a, relativePhaseDeg: phaseDeg });
  return { ...check, relativePhaseDeg: phaseDeg, faceOverlapMM: overlap };
}
