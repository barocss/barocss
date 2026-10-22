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
//
// R12b.1a (D130): the generated root (`rootPolicy: 'generated'`, generator `spur-gear@1`) — the root the basic rack cuts
// as it rolls on the pitch circle: its flat tip gives the root circle, its tip round (radius ρ, 0.38 m by default) the
// fillet, the envelope of the round in closed form (D129), up to where it meets the involute — tangentially at the form
// circle, or, when the gear is undercut, where it crosses it (the involute below is cut away).
import { buildBrep, type Brep, type BrepFaceInput } from './brep-core.js';
import type { Curve, Point, Surface } from './types.js';

export type GearDiagnosticCode = 'INVALID_INPUT' | 'UNSUPPORTED_PROFILE_SHIFT' | 'UNSUPPORTED_GEAR_KIND' | 'PROFILE_BUDGET_EXCEEDED' | 'SELF_INTERSECTION' | 'ROOT_TRANSITION_UNVALIDATED' | 'BORE_INTERSECTION' | 'MATE_INCOMPATIBLE' | 'UNDERCUT' | 'INVOLUTE_INTERFERENCE' | 'TROCHOID_INTERFERENCE' | 'TRIMMING_INTERFERENCE' | 'RIM_INTERSECTION' | 'IDEAL_MODEL';
export interface GearDiagnostic { readonly code: GearDiagnosticCode; readonly severity: 'error' | 'warning'; readonly message: string }
export class GearError extends Error {
  constructor(readonly code: GearDiagnosticCode, detail: string) { super(`gear: ${detail}`); this.name = 'GearError'; }
}

/** Version 0 of the spur gear's inputs (lengths in mm). */
export interface SpurGearSpec {
  /** A spur gear's module. (A helical gear's is `normalModuleMM`; giving this with a helix angle is refused.) */
  readonly moduleMM?: number;
  /** A helical gear (R6a.5c, D59): its normal module m_n, helix angle β at the reference circle (0 < β ≤ 45°) and hand. */
  readonly normalModuleMM?: number;
  readonly helixAngleDeg?: number;
  readonly hand?: 'right' | 'left';
  readonly teeth: number;
  /** The reference pressure angle (a helical gear's normal one, α_n); 20° only in this stage. */
  readonly pressureAngleDeg?: number;
  readonly faceWidthMM: number;
  /** x, the cutting rack moved out by x m (R6a.5, D57): from −0.5 to 1 (UNSUPPORTED_PROFILE_SHIFT otherwise). */
  readonly profileShiftCoefficient?: number;
  /** 0: no bore. */
  readonly boreDiameterMM?: number;
  /** This gear's circumferential tooth thickness taken off at the reference circle (its share of a pair's backlash). */
  readonly toothThicknessReductionMM?: number;
  /**
   * How the root joins the flanks: 'schematic-radial' (the default; generator spur-gear@0) or 'generated' (R12b.1a,
   * D130; spur-gear@1): the root the basic rack cuts, its tip rounded by `toolTipRadiusMM` — spur and (R12b.1b, D131) helical.
   */
  readonly rootPolicy?: 'schematic-radial' | 'generated';
  /** The basic rack's tip radius ρ for a generated root (default 0.38 m); it must leave a flat between the two rounds. */
  readonly toolTipRadiusMM?: number;
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
  readonly generator: 'spur-gear@0' | 'spur-gear@1';
  readonly dimensions: SpurGearDimensions;
  /** The profile shift coefficient x it was cut with (0: none). */
  readonly profileShift: number;
  /**
   * A helical gear's (R6a.5c, D59): its normal and transverse module and pressure angle, helix angle and hand, lead,
   * the total twist over the face, and the fit of that twist — its largest deviation at the tip circle (the flank
   * surface lies within profileDeviationMM + twistDeviationMM of the involute helicoid), the axial segments and the
   * cubic pieces in each.
   */
  readonly helix?: { readonly normalModuleMM: number; readonly transverseModuleMM: number; readonly transversePressureAngleDeg: number; readonly helixAngleDeg: number; readonly hand: 'right' | 'left';
    readonly leadMM: number; readonly twistDegrees: number; readonly twistDeviationMM: number; readonly axialSegments: number; readonly piecesPerSegment: number };
  /** Cubic pieces in each flank, and the largest measured deviation of a flank from the involute (mm). */
  readonly flankPieces: number; readonly profileDeviationMM: number; readonly profileToleranceMM: number;
  readonly rootPolicy: 'schematic-radial' | 'generated'; readonly manufacturingValidated: false;
  /**
   * A generated root's (R12b.1a): the tool's tip radius; the diameter where the involute begins — the form circle, or
   * where the tool cuts the involute when `undercut`; the fillet's cubic pieces and their largest measured deviation
   * from the envelope (a bound: at the same tool position).
   */
  readonly generatedRoot?: { readonly toolTipRadiusMM: number; readonly formDiameterMM: number; readonly undercut: boolean; readonly filletPieces: number; readonly filletDeviationMM: number };
  readonly diagnostics: readonly GearDiagnostic[];
}

/** A curve of the profile in the plane (z 0): its role, the tooth it belongs to (1-based) and its curve. */
interface Piece { readonly role: 'flankL' | 'flankR' | 'tip' | 'root' | 'rootL' | 'rootR' | 'filletL' | 'filletR' | 'bore'; readonly tooth: number; readonly curve: Curve; readonly part?: number }

const MAX_PIECES = 5, MAX_FILLET_PIECES = 15, MAX_SEGMENTS = 64, MAX_TEETH = 200, MIN_SHIFT = -0.5, MAX_SHIFT = 1, MIN_TEETH_GENERATED = 6;
export const inv = (phi: number) => Math.tan(phi) - phi;

/** The gear's dimensions and the checks of this stage's inputs (refusals thrown, as GearError). */
export function spurGearDimensions(spec: SpurGearSpec): SpurGearDimensions & { alpha: number; rb: number; ra: number; rf: number; r: number; psi: number; mn: number; mt: number; beta: number; alphaN: number; rs: number; root?: RackRoot } {
  const z = spec.teeth, b = spec.faceWidthMM, helical = spec.helixAngleDeg !== undefined && spec.helixAngleDeg !== 0;
  // Spur: `moduleMM`. Helical: the normal module, β and the hand, named so (a transverse module is never taken for it).
  let m: number, beta = 0;
  if (helical) {
    const bd = spec.helixAngleDeg!;
    if (spec.moduleMM !== undefined) throw new GearError('INVALID_INPUT', 'a helical gear takes normalModuleMM (the normal module), not moduleMM');
    if (!(Number.isFinite(bd) && bd > 0 && bd <= 45)) throw new GearError('UNSUPPORTED_GEAR_KIND', `helix angle ${bd}°: from above 0 to 45° in this stage (the hand gives the sense)`);
    if (spec.hand !== 'right' && spec.hand !== 'left') throw new GearError('INVALID_INPUT', "a helical gear needs its hand, 'right' or 'left'");
    m = spec.normalModuleMM as number; beta = (spec.hand === 'right' ? 1 : -1) * bd * Math.PI / 180;
  } else {
    if (spec.normalModuleMM !== undefined || spec.hand !== undefined) throw new GearError('INVALID_INPUT', 'normalModuleMM and hand belong to a helical gear: give helixAngleDeg too (a spur gear takes moduleMM)');
    m = spec.moduleMM as number;
  }
  if (!(Number.isFinite(m) && m > 0 && m <= 100)) throw new GearError('INVALID_INPUT', `${helical ? 'normalModuleMM' : 'moduleMM'} must be a number of mm above 0, at most 100`);
  if (!(Number.isInteger(z) && z >= 1)) throw new GearError('INVALID_INPUT', 'teeth must be a whole number');
  if (!(Number.isFinite(b) && b > 0 && b <= 10000)) throw new GearError('INVALID_INPUT', 'faceWidthMM must be a number of mm above 0');
  const alphaDeg = spec.pressureAngleDeg ?? 20;
  if (alphaDeg !== 20) throw new GearError('UNSUPPORTED_GEAR_KIND', `pressure angle ${alphaDeg}°: only 20° in this stage`);
  const x = spec.profileShiftCoefficient ?? 0;
  if (!Number.isFinite(x)) throw new GearError('INVALID_INPUT', 'profileShiftCoefficient must be a number');
  // (R12b.1a, R12b.1b: the generated root, spur and helical.)
  const generated = spec.rootPolicy === 'generated';
  if (spec.rootPolicy !== undefined && spec.rootPolicy !== 'schematic-radial' && !generated) throw new GearError('INVALID_INPUT', `root policy ${String(spec.rootPolicy)}: 'schematic-radial' or 'generated'`);
  if (!generated && spec.toolTipRadiusMM !== undefined) throw new GearError('INVALID_INPUT', "toolTipRadiusMM belongs to a generated root (rootPolicy 'generated')");
  if (generated && z < MIN_TEETH_GENERATED) throw new GearError('INVALID_INPUT', `a generated root takes at least ${MIN_TEETH_GENERATED} teeth in this stage`);
  if (!(x >= MIN_SHIFT && x <= MAX_SHIFT)) throw new GearError('UNSUPPORTED_PROFILE_SHIFT', `profile shift ${x}: from ${MIN_SHIFT} to ${MAX_SHIFT} in this stage`);
  // Helical: the transverse module and pressure angle, m_t = m_n / cos β, tan α_t = tan α_n / cos β.
  const alphaN = alphaDeg * Math.PI / 180, cb = Math.cos(beta), mt = m / cb, alpha = Math.atan(Math.tan(alphaN) / cb);
  // Undercut: the basic rack's addendum line, moved out by x m, cuts below the base circle under z = 2(1 − x)/sin²α
  // (about 17.1 at 20° unshifted); a helical gear by its virtual tooth number z_v = z / cos³β.
  const zv = z / cb ** 3, zMin = 2 * (1 - x) / Math.sin(alphaN) ** 2;
  // (A generated root takes the undercut as the tool cuts it: the involute trimmed, said with UNDERCUT.)
  if (zv < zMin && !generated) throw new GearError('UNSUPPORTED_PROFILE_SHIFT', `${z} teeth${helical ? ` (virtual ${zv.toFixed(2)} at β ${spec.helixAngleDeg}°)` : ''} at 20°${x ? ` with x = ${x}` : ' without profile shift'} are undercut (below ${zMin.toFixed(1)}): a shift of at least x = ${(1 - zv * Math.sin(alphaN) ** 2 / 2).toFixed(3)} would avoid it`);
  if (z > MAX_TEETH) throw new GearError('INVALID_INPUT', `teeth at most ${MAX_TEETH} in this stage`);
  // The shifted gear cut by the standard rack (addendum m, dedendum 1.25 m) moved out by x m: tip and root move out by
  // x m, the reference tooth thickens by 2 x m tan α. (No tip shortening: that depends on the mate; the pair checks
  // report the tip clearances.)
  const d = mt * z, r = d / 2, rb = r * Math.cos(alpha), ra = r + m * (1 + x), rf = r - m * (1.25 - x);
  const red = spec.toothThicknessReductionMM ?? 0;
  if (!(Number.isFinite(red) && red >= 0)) throw new GearError('INVALID_INPUT', 'toothThicknessReductionMM must be a number of mm, 0 or more');
  const s0 = mt * (Math.PI / 2 + 2 * x * Math.tan(alphaN)), s = s0 - red;
  if (!(s > 0)) throw new GearError('INVALID_INPUT', `a thickness reduction of ${red} mm leaves no tooth (the reference thickness is ${s0.toFixed(4)} mm)`);
  const psi = s / d + inv(alpha), tipHalf = psi - inv(Math.acos(rb / ra));
  if (!(tipHalf > 0)) throw new GearError('SELF_INTERSECTION', `the tooth comes to a point below its tip circle${x > 0 ? ` (a shift of ${x} on ${z} teeth)` : ''}`);
  const root = generated ? rackRoot(m, z, x, red, spec.toolTipRadiusMM ?? 0.38 * m, r, rb, ra, psi, beta ? alpha : alphaN, beta, beta ? mt : m) : undefined;
  return { referenceDiameterMM: d, baseDiameterMM: 2 * rb, tipDiameterMM: 2 * ra, rootDiameterMM: 2 * rf, circularPitchMM: Math.PI * mt, toothThicknessMM: s, tipThicknessMM: 2 * ra * tipHalf, alpha, rb, ra, rf, r, psi, mn: m, mt, beta, alphaN, rs: root ? root.rStart : Math.max(rb, rf), ...(root ? { root } : {}) };
}

/**
 * A generated root (R12b.1a, D130), in the frame where the tooth space it cuts is centred on +Y and the tooth it bounds
 * lies at π/2 − π/z: the basic rack as the tool — addendum 1.25 m into the gear, flanks at α, its tooth πm/2 + Δs wide on
 * its reference line (Δs the gear's thickness reduction), the line at r + x m — its tip round's centre (xc, yc) when the
 * gear stands at 0 (rounds ρ, tangent to the flank and to the flat tip between them). As the gear turns φ the rack moves
 * by −rφ. `phiRoot` (= xc / r) is the turn at which the round's lowest point touches the root circle, `phiEnd` the one at
 * which the fillet meets the involute, at radius `rStart`.
 *
 * A helical gear's (R12b.1b, D131) in its transverse plane: the normal rack's round, a cylinder along the tooth (at β to
 * the axis), cut by that plane is an ellipse — semi-axes a = ρ / cos β along the pitch line, b = ρ across it — tangent
 * to the transverse flank (at α_t) and the flat tip; the pitch π m_t, heights in m_n. A spur gear's: a = b = ρ.
 */
export interface RackRoot { readonly rho: number; readonly a: number; readonly b: number; readonly xc: number; readonly yc: number; readonly r: number; readonly rb: number; readonly psi: number; readonly z: number; readonly thetaEnd: number; readonly phiRoot: number; readonly phiEnd: number; readonly rStart: number; readonly undercut: boolean }

/**
 * The gear's turn at which the tip ellipse touches it at its point of angle θ (from the centre, x = a cos θ, y = b sin θ):
 * its normal (b cos θ, a sin θ) there passes through the pitch point (0, r) — closed form (D131).
 */
function phiOfTheta(R: RackRoot, th: number): number {
  return (R.xc + R.a * Math.cos(th) + R.b / R.a * (R.r - R.yc - R.b * Math.sin(th)) * Math.cos(th) / Math.sin(th)) / R.r;
}
/** dφ/dθ of `phiOfTheta`. */
function phiOfThetaD(R: RackRoot, th: number): number {
  const s = Math.sin(th), c = Math.cos(th);
  return (-R.a * s + R.b / R.a * (-R.b * c * c / s - (R.r - R.yc - R.b * s) / (s * s))) / R.r;
}
/** The ellipse angle θ ∈ [−π/2, θ_end] touching at the turn φ (φ falls as θ rises): bisection, then Newton. */
function thetaAt(R: RackRoot, phi: number): number {
  let lo = -Math.PI / 2, hi = R.thetaEnd;
  for (let i = 0; i < 64; i++) { const mid = (lo + hi) / 2; if (phiOfTheta(R, mid) > phi) lo = mid; else hi = mid; }
  let th = (lo + hi) / 2;
  for (let i = 0; i < 2; i++) th -= (phiOfTheta(R, th) - phi) / phiOfThetaD(R, th);
  return th;
}

/**
 * The fillet's point at the gear's turn φ: the tip round's centre is (xc − rφ, yc), the pitch point (0, r); the gear is
 * touched at the round's point on the line through the two, on the far side from the pitch point (its normal passes
 * through the instant centre), that point turned back by −φ into the gear's frame (D129). A helical gear's ellipse: at
 * the angle θ the turn calls for (D131).
 */
export function filletPoint(R: RackRoot, phi: number): [number, number] {
  const c = Math.cos(phi), s = Math.sin(phi);
  if (R.a !== R.b) {
    const th = thetaAt(R, phi), wx = R.xc - R.r * phi + R.a * Math.cos(th), wy = R.yc + R.b * Math.sin(th);
    return [c * wx + s * wy, -s * wx + c * wy];
  }
  const dx = R.xc - R.r * phi, dy = R.yc - R.r, L = Math.hypot(dx, dy), wx = dx + R.rho * dx / L, wy = R.yc + R.rho * dy / L;
  return [c * wx + s * wy, -s * wx + c * wy];
}
/** The fillet's derivative in φ: p = Rot(−φ) w, so p′ = Rot(−φ)(w′ − J w), J the quarter turn; w′ = (−r, 0) + ρ u′ (an ellipse's: the point's θ′ = 1 / φ′(θ)). */
function filletDerivative(R: RackRoot, phi: number): [number, number] {
  const c = Math.cos(phi), s = Math.sin(phi);
  if (R.a !== R.b) {
    const th = thetaAt(R, phi), tp = 1 / phiOfThetaD(R, th), wx = R.xc - R.r * phi + R.a * Math.cos(th), wy = R.yc + R.b * Math.sin(th);
    const vx = -R.r - R.a * Math.sin(th) * tp + wy, vy = R.b * Math.cos(th) * tp - wx;
    return [c * vx + s * vy, -s * vx + c * vy];
  }
  const dx = R.xc - R.r * phi, dy = R.yc - R.r, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, wx = dx + R.rho * ux, wy = R.yc + R.rho * uy;
  // u′ = (d′ − u (u·d′)) / L with d′ = (−r, 0).
  const ud = -R.r * ux, dux = (-R.r - ux * ud) / L, duy = (-uy * ud) / L, vx = -R.r + R.rho * dux + wy, vy = R.rho * duy - wx;
  return [c * vx + s * vy, -s * vx + c * vy];
}
/** The involute's polar angle at radius ρ ≥ rb on the tooth the fillet bounds (the frame of `RackRoot`). */
const involuteAngleAt = (R: RackRoot, rho: number) => Math.PI / 2 - Math.PI / R.z + R.psi - inv(Math.acos(Math.min(1, R.rb / rho)));
/** How far the fillet's point at φ stands from the involute, as polar angle (≥ 0: on the tooth's side). */
function filletOffInvolute(R: RackRoot, phi: number): number {
  const p = filletPoint(R, phi);
  return Math.atan2(p[1], p[0]) - involuteAngleAt(R, Math.hypot(p[0], p[1]));
}

/**
 * The generated root's tool and where its fillet ends (D129, D130). Not undercut — the round's tangent point with the
 * flank, hF = (1.25 − x)m − ρ(1 − sin α) below the pitch line, generates the involute's first point on the line of action
 * (r sin α − hF / sin α ≥ 0 from the base circle's tangent point) — the fillet meets the involute there, tangentially, at
 * the form circle √(rb² + (r sin α − hF / sin α)²). Undercut, the round's envelope crosses the involute above the base
 * circle, and the involute below the crossing is cut away: the fillet ends at the crossing (found by bisection).
 * Helical (D131): in the transverse plane, the ellipse's tangent point with the flank at θ_F = −atan((b / a) tan α_t),
 * hF = r − (yc + b sin θ_F), α the transverse α_t, the tooth π m_t / 2 + Δs.
 */
function rackRoot(m: number, z: number, x: number, red: number, rho: number, r: number, rb: number, ra: number, psi: number, alpha: number, beta: number, mt: number): RackRoot {
  const hA = 1.25 * m, ta = Math.tan(alpha), sa = Math.sin(alpha), ca = Math.cos(alpha), a = beta ? rho / Math.cos(beta) : rho, b = rho;
  // (The ellipse's reach along the flank's normal, √(a² cos² α + b² sin² α): ρ for a circle.)
  const reach = beta ? Math.sqrt(a * a * ca * ca + b * b * sa * sa) : rho, k = reach / rho;
  const rhoMax = (Math.PI * mt / 4 + red / 2 - hA * ta) / (k / ca - ta);
  if (!(Number.isFinite(rho) && rho > 0 && rho < rhoMax)) throw new GearError('INVALID_INPUT', `toolTipRadiusMM must be above 0 and below ${rhoMax.toFixed(6)} mm (where the rack's two tip rounds meet)`);
  const hc = hA - rho, xc = Math.PI * mt / 4 + red / 2 - hc * ta - reach / ca, yc = r + x * m - hc, phiRoot = xc / r;
  const thetaF = beta ? -Math.atan(b / a * ta) : -alpha;
  const base: RackRoot = { rho, a, b, xc, yc, r, rb, psi, z, thetaEnd: thetaF, phiRoot, phiEnd: 0, rStart: 0, undercut: false };
  const phiF = beta ? phiOfTheta(base, thetaF) : (xc - (r - yc) / ta) / r;
  const lead = beta ? r * sa - (r - (yc + b * Math.sin(thetaF))) / sa : r * sa - (hA - x * m - rho * (1 - sa)) / sa;
  let phiEnd = phiF, undercut = false;
  if (lead < 0) {
    // Where the fillet reaches the base circle (its radius grows as φ falls from φRoot), then the crossing above it.
    let lo = phiF, hi = phiRoot;
    const rAt = (phi: number) => Math.hypot(...filletPoint(base, phi));
    if (rAt(hi) < rb) { for (let i = 0; i < 200 && hi - lo > 1e-15; i++) { const mid = (lo + hi) / 2; if (rAt(mid) >= rb) lo = mid; else hi = mid; } hi = lo; }
    lo = phiF;
    if (!(filletOffInvolute(base, lo) > 0 && filletOffInvolute(base, hi) < 0)) throw new GearError('SELF_INTERSECTION', 'the undercut fillet does not meet the involute');
    for (let i = 0; i < 200 && hi - lo > 1e-15; i++) { const mid = (lo + hi) / 2; if (filletOffInvolute(base, mid) > 0) lo = mid; else hi = mid; }
    phiEnd = (lo + hi) / 2; undercut = true;
  }
  const end = filletPoint(base, phiEnd), rStart = Math.hypot(end[0], end[1]);
  if (!(rStart < ra)) throw new GearError('SELF_INTERSECTION', `the undercut cuts the whole flank away (the tool reaches Ø${(2 * rStart).toFixed(4)} mm, the tip is Ø${(2 * ra).toFixed(4)})`);
  // The fillet stays between the tooth's middle and the space's: else the tool cuts through the tooth (or the space's two fillets cross).
  const toothAt = Math.PI / 2 - Math.PI / z;
  for (let i = 0; i <= 64; i++) {
    const p = filletPoint(base, phiRoot + (phiEnd - phiRoot) * i / 64), an = Math.atan2(p[1], p[0]);
    if (!(an > toothAt && an <= Math.PI / 2 + 1e-12)) throw new GearError('SELF_INTERSECTION', `the tool cuts through the tooth's root (${z} teeth${x ? `, x = ${x}` : ''})`);
  }
  return { ...base, phiEnd, rStart, undercut };
}
/**
 * The fillet's breaks in φ for N cubic pieces, root to involute: spread so that each piece turns the fillet's tangent by
 * as much as the next (the envelope bends hardest near the root), with a little of its length besides (no piece empty).
 */
function filletBreaks(R: RackRoot, N: number): number[] {
  const M = 256, cum = new Float64Array(M + 1), span = R.phiEnd - R.phiRoot;
  let prev = 0;
  for (let i = 0; i <= M; i++) {
    const d = filletDerivative(R, R.phiRoot + span * i / M), t = Math.atan2(d[1], d[0]);
    if (i > 0) { let dt = t - prev; dt -= 2 * Math.PI * Math.round(dt / (2 * Math.PI)); cum[i] = cum[i - 1] + Math.abs(dt) + 0.05 * Math.hypot(d[0], d[1]) * Math.abs(span) / M / R.rho; }
    prev = t;
  }
  const out = [R.phiRoot];
  for (let k = 1, i = 1; k < N; k++) {
    const target = cum[M] * k / N;
    while (cum[i] < target) i++;
    out.push(R.phiRoot + span * (i - 1 + (target - cum[i - 1]) / (cum[i] - cum[i - 1])) / M);
  }
  out.push(R.phiEnd);
  return out;
}
/**
 * The fillet's Bézier control points (3n + 1, z 0) over the breaks phis[j0] → phis[j1], C¹ Hermite pieces on φ: in the
 * gear's frame with the tooth centred on angle 0 (the fillet on its counter-clockwise side), mirrored in the x axis first
 * when `mirror` (the clockwise side), then turned by `turn`.
 */
function filletPoles(R: RackRoot, phis: readonly number[], j0: number, j1: number, turn: number, mirror: boolean): Point[] {
  const a0 = Math.PI / R.z - Math.PI / 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c = Math.cos(turn), s = Math.sin(turn), out: Point[] = [];
  const put = (px: number, py: number) => { const qx = c0 * px - s0 * py, qy0 = s0 * px + c0 * py, qy = mirror ? -qy0 : qy0; out.push([c * qx - s * qy, s * qx + c * qy, 0]); };
  for (let k = j0; k < j1; k++) {
    const pa = phis[k], pb = phis[k + 1], h = pb - pa;
    const A = filletPoint(R, pa), B = filletPoint(R, pb), DA = filletDerivative(R, pa), DB = filletDerivative(R, pb);
    if (k === j0) put(A[0], A[1]);
    put(A[0] + h / 3 * DA[0], A[1] + h / 3 * DA[1]); put(B[0] - h / 3 * DB[0], B[1] - h / 3 * DB[1]); put(B[0], B[1]);
  }
  return out;
}
/** The largest distance of the fillet's fit over `phis` from the envelope at the same φ (a bound on its distance from the curve). */
function filletDeviation(R: RackRoot, phis: readonly number[]): number {
  const N = phis.length - 1, P = filletPoles(R, phis, 0, N, Math.PI / 2 - Math.PI / R.z, false);
  let worst = 0;
  for (let k = 0; k < N; k++) for (let i = 0; i <= 64; i++) {
    const t = i / 64, u = 1 - t, a = P[3 * k], b = P[3 * k + 1], cc = P[3 * k + 2], d = P[3 * k + 3];
    const x = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * cc[0] + t * t * t * d[0], y = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * cc[1] + t * t * t * d[1];
    const q = filletPoint(R, phis[k] + (phis[k + 1] - phis[k]) * t);
    worst = Math.max(worst, Math.hypot(x - q[0], y - q[1]));
  }
  return worst;
}

/**
 * A root fillet as any tool generates it (R12b.2b: a shaper cutter's tip round, D133): its point and derivative at the
 * tool's turn φ in its own frame, run from `phiRoot` (the root side) to `phiEnd` (where it meets the involute), the
 * tool's tip radius `rho`. The fit below is the rack's (D130), on this interface.
 */
export interface Envelope { point(phi: number): [number, number]; derivative(phi: number): [number, number]; readonly phiRoot: number; readonly phiEnd: number; readonly rho: number }
/** An envelope's breaks for N pieces, at equal tangent turning (as `filletBreaks`). */
export function envelopeBreaks(E: Envelope, N: number): number[] {
  const M = 256, cum = new Float64Array(M + 1), span = E.phiEnd - E.phiRoot;
  let prev = 0;
  for (let i = 0; i <= M; i++) {
    const d = E.derivative(E.phiRoot + span * i / M), t = Math.atan2(d[1], d[0]);
    if (i > 0) { let dt = t - prev; dt -= 2 * Math.PI * Math.round(dt / (2 * Math.PI)); cum[i] = cum[i - 1] + Math.abs(dt) + 0.05 * Math.hypot(d[0], d[1]) * Math.abs(span) / M / E.rho; }
    prev = t;
  }
  const out = [E.phiRoot];
  for (let k = 1, i = 1; k < N; k++) {
    const target = cum[M] * k / N;
    while (cum[i] < target) i++;
    out.push(E.phiRoot + span * (i - 1 + (target - cum[i - 1]) / (cum[i] - cum[i - 1])) / M);
  }
  out.push(E.phiEnd);
  return out;
}
/** An envelope's C¹ Hermite Bézier poles over the breaks phis[j0] → phis[j1], in its own frame (z 0). */
export function envelopePoles(E: Envelope, phis: readonly number[], j0: number, j1: number): Point[] {
  const out: Point[] = [];
  for (let k = j0; k < j1; k++) {
    const pa = phis[k], pb = phis[k + 1], h = pb - pa, A = E.point(pa), B = E.point(pb), DA = E.derivative(pa), DB = E.derivative(pb);
    if (k === j0) out.push([A[0], A[1], 0]);
    out.push([A[0] + h / 3 * DA[0], A[1] + h / 3 * DA[1], 0], [B[0] - h / 3 * DB[0], B[1] - h / 3 * DB[1], 0], [B[0], B[1], 0]);
  }
  return out;
}
/** The largest distance of an envelope's fit over `phis` from the envelope at the same φ (a bound). */
export function envelopeDeviation(E: Envelope, phis: readonly number[]): number {
  const N = phis.length - 1, P = envelopePoles(E, phis, 0, N);
  let worst = 0;
  for (let k = 0; k < N; k++) for (let i = 0; i <= 64; i++) {
    const t = i / 64, u = 1 - t, a = P[3 * k], b = P[3 * k + 1], cc = P[3 * k + 2], d = P[3 * k + 3];
    const x = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * cc[0] + t * t * t * d[0], y = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * cc[1] + t * t * t * d[1];
    const q = E.point(phis[k] + (phis[k + 1] - phis[k]) * t);
    worst = Math.max(worst, Math.hypot(x - q[0], y - q[1]));
  }
  return worst;
}

/** The involute point at roll t (from the base circle at angle 0, unwinding counter-clockwise) and its derivative. */
const involute = (rb: number, t: number): [number, number] => [rb * (Math.cos(t) + t * Math.sin(t)), rb * (Math.sin(t) - t * Math.cos(t))];
const involuteD = (rb: number, t: number): [number, number] => [rb * t * Math.cos(t), rb * t * Math.sin(t)];

/**
 * One flank's Bézier control points (3N + 1, z 0) in the tooth's frame, over the roll t0 → t1, N C¹ Hermite pieces:
 * the involute turned by `turn`, mirrored in its x axis first when `mirror`.
 */
export function flankPoles(rb: number, t0: number, t1: number, N: number, turn: number, mirror: boolean): Point[] {
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
export function flankDeviation(rb: number, t0: number, t1: number, N: number): number {
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
export const bezierKnots = (N: number) => { const k = [0, 0, 0, 0]; for (let i = 1; i < N; i++) k.push(i, i, i); k.push(N, N, N, N); return k; };
export const lineCurve = (id: string, a: Point, b: Point): Curve => ({ kind: 'curve', id, degree: 1, knots: [0, 0, 1, 1], controlPoints: [a, b], weights: [1, 1] });
/** A circular arc about the origin, radius r, from angle a0 counter-clockwise by sweep (> 0; spans of at most 90°), or clockwise when sweep < 0. */
export function arcCurve(id: string, r: number, a0: number, sweep: number): Curve {
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
export const reversed = (c: Curve): Curve => ({ ...c, controlPoints: [...c.controlPoints].reverse(), weights: [...c.weights].reverse(), knots: c.knots.map(k => c.knots[0] + c.knots[c.knots.length - 1] - k).reverse() });

/** The gear's profile: its curves counter-clockwise round the gear (the bore's clockwise), and its report. */
export function spurGearProfile(spec: SpurGearSpec): { pieces: Piece[]; bore: Piece[]; report: SpurGearReport } {
  const g = spurGearDimensions(spec), m = g.mn, z = spec.teeth, root = g.root;
  const tol = spec.profileToleranceMM ?? 1e-4 * m;
  if (!(Number.isFinite(tol) && tol > 0)) throw new GearError('INVALID_INPUT', 'profileToleranceMM must be a number of mm above 0');
  // (The involute starts at max(rb, rf) under the schematic root; at the form circle, or the undercut's crossing, under a generated one.)
  const r0 = g.rs, t0 = Math.sqrt(Math.max(0, (r0 / g.rb) ** 2 - 1)), t1 = Math.sqrt((g.ra / g.rb) ** 2 - 1);
  // As few pieces as the tolerance asks; past the budget, refused (never a looser tolerance).
  let N = 1, deviation = flankDeviation(g.rb, t0, t1, 1);
  while (deviation > tol && N < MAX_PIECES) deviation = flankDeviation(g.rb, t0, t1, ++N);
  if (deviation > tol) throw new GearError('PROFILE_BUDGET_EXCEEDED', `a flank within ${tol} mm of the involute needs more than ${MAX_PIECES} cubic pieces (${MAX_PIECES} come to ${deviation.toExponential(2)} mm)`);
  // A generated root's fillet: as few pieces as the tolerance asks, at most five to a face and three faces (the
  // envelope bends hard near the root, ρ-tight); past that refused, likewise.
  let NF = 0, filletDev = 0, breaks: number[] = [];
  if (root) {
    NF = 1; breaks = filletBreaks(root, 1); filletDev = filletDeviation(root, breaks);
    while (filletDev > tol && NF < MAX_FILLET_PIECES) { breaks = filletBreaks(root, ++NF); filletDev = filletDeviation(root, breaks); }
    if (filletDev > tol) throw new GearError('PROFILE_BUDGET_EXCEEDED', `a root fillet within ${tol} mm of the tool's envelope needs more than ${MAX_FILLET_PIECES} cubic pieces (${MAX_FILLET_PIECES} come to ${filletDev.toExponential(2)} mm)`);
  }
  const filletFaces = Math.ceil(NF / MAX_PIECES);
  // Half thickness at r0, at the tip; the flanks' turns: the left flank (lower angle) is the involute turned to
  // γ − ψ(rb), the right its mirror turned to γ + ψ(rb) (ψ(rb) = s/d + inv α: the involute starts at the base circle).
  const psiBase = g.psi, psiStart = g.psi - inv(Math.acos(g.rb / r0)), psiTip = g.psi - inv(Math.acos(g.rb / g.ra));
  const radial = !root && g.rf < g.rb, pieces: Piece[] = [], step = 2 * Math.PI / z;
  if (!root && !(step - 2 * psiStart > 1e-9)) throw new GearError('SELF_INTERSECTION', 'neighbouring teeth meet at the root');
  for (let k = 0; k < z; k++) {
    const gam = step * k, n = k + 1;
    if (root) {
      // The fillet up from the root on the tooth's clockwise side, the flanks and tip, the fillet down on its other
      // side, then the root arc the rack's flat tip cuts, ±xc / r about the next space's middle.
      const L = flankPoles(g.rb, t0, t1, N, gam - psiBase, false), R = flankPoles(g.rb, t0, t1, N, gam + psiBase, true);
      // (A fillet of more than five pieces goes on faces of at most five each, root outward: `filletL#k`, `filletL2#k`, `filletL3#k`.)
      for (let j = 0; j < filletFaces; j++) {
        const j0 = Math.round(NF * j / filletFaces), j1 = Math.round(NF * (j + 1) / filletFaces), FL = filletPoles(root, breaks, j0, j1, gam, true);
        pieces.push({ role: 'filletL', tooth: n, part: j, curve: { kind: 'curve', id: 'q', degree: 3, knots: bezierKnots(j1 - j0), controlPoints: FL, weights: FL.map(() => 1) } });
      }
      pieces.push({ role: 'flankL', tooth: n, curve: { kind: 'curve', id: 'f', degree: 3, knots: bezierKnots(N), controlPoints: L, weights: L.map(() => 1) } });
      pieces.push({ role: 'tip', tooth: n, curve: arcCurve('t', g.ra, gam - psiTip, 2 * psiTip) });
      pieces.push({ role: 'flankR', tooth: n, curve: reversed({ kind: 'curve', id: 'f', degree: 3, knots: bezierKnots(N), controlPoints: R, weights: R.map(() => 1) }) });
      for (let j = filletFaces - 1; j >= 0; j--) {
        const j0 = Math.round(NF * j / filletFaces), j1 = Math.round(NF * (j + 1) / filletFaces), FR = filletPoles(root, breaks, j0, j1, gam, false);
        pieces.push({ role: 'filletR', tooth: n, part: j, curve: reversed({ kind: 'curve', id: 'q', degree: 3, knots: bezierKnots(j1 - j0), controlPoints: FR, weights: FR.map(() => 1) }) });
      }
      pieces.push({ role: 'root', tooth: n, curve: arcCurve('r', g.rf, gam + Math.PI / z - root.phiRoot, 2 * root.phiRoot) });
      continue;
    }
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
  const diagnostics: GearDiagnostic[] = root
    ? root.undercut ? [{ code: 'UNDERCUT', severity: 'warning', message: `undercut: the tool's tip cuts the involute away below Ø${(2 * root.rStart).toFixed(4)} mm (the base circle Ø${(2 * g.rb).toFixed(4)}); the flank starts there` }] : []
    : [{ code: 'ROOT_TRANSITION_UNVALIDATED', severity: 'warning', message: radial ? 'the root joins the flanks by radial lines from the base circle and a root arc: a schematic root, not the one the cutting tool generates' : 'the flanks meet the root arc at a corner: a schematic root, not the one the cutting tool generates' }];
  const dims: SpurGearDimensions = { referenceDiameterMM: g.referenceDiameterMM, baseDiameterMM: g.baseDiameterMM, tipDiameterMM: g.tipDiameterMM, rootDiameterMM: g.rootDiameterMM, circularPitchMM: g.circularPitchMM, toothThicknessMM: g.toothThicknessMM, tipThicknessMM: g.tipThicknessMM };
  return { pieces, bore, report: { generator: root ? 'spur-gear@1' : 'spur-gear@0', dimensions: dims, profileShift: spec.profileShiftCoefficient ?? 0, flankPieces: N, profileDeviationMM: deviation, profileToleranceMM: tol, rootPolicy: root ? 'generated' : 'schematic-radial', manufacturingValidated: false,
    ...(root ? { generatedRoot: { toolTipRadiusMM: root.rho, formDiameterMM: 2 * root.rStart, undercut: root.undercut, filletPieces: NF, filletDeviationMM: filletDev } } : {}), diagnostics } };
}


/**
 * The gear as a solid: its profile pulled from z 0 through the face width, the bore through it. Faces `<id>.flankL#k`
 * and `.flankR#k` (tooth k's flanks), `.tip#k`, `.root#k` (the root arc after tooth k), `.rootL#k`/`.rootR#k` (the
 * schematic radial joins) or `.filletL#k`/`.filletR#k` (a generated root's fillets, R12b.1a; a fillet of more than five
 * pieces on more faces, root outward, `.filletL2#k`, `.filletL3#k`), `.face0`/`.face1` (z 0 /
 * the far face), `.bore#1`/`#2`.
 */
export function spurGear(spec: SpurGearSpec, options: { readonly id?: string } = {}): { brep: Brep; report: SpurGearReport } {
  const id = safeId(options.id ?? 'gear');
  const { pieces, bore, report: flat } = spurGearProfile(spec);
  // (A fillet's later faces: `filletL2#k`, `filletL3#k` — the tooth last, so a helical gear's axial segments, `#k.2`, stay apart, D131.)
  const nameOf = (p: Piece) => p.role === 'bore' ? `${id}.bore#${p.tooth}` : `${id}.${p.role}${p.part ? p.part + 1 : ''}#${p.tooth}`;
  const g = spurGearDimensions(spec), h = helixTwist(spec, g, flat.profileToleranceMM), twist = h?.twist, report = h ? { ...flat, helix: h.helix } : flat;
  const brep = extrudedProfile(id, 'gear', pieces.map(p => ({ name: nameOf(p), curve: p.curve })), bore.map(p => ({ name: nameOf(p), curve: p.curve })), spec.faceWidthMM, report.dimensions.tipDiameterMM / 2 + 1, twist);
  return { brep, report };
}
/**
 * A helical gear's twist (R6a.5c, D59): the transverse profile turned by z tan β / r as it rises (the lead 2πr / tan β).
 * As few cubic pieces of the twist as keep it within the tolerance at the outermost circle `g.ra`, at most four to an
 * axial segment (the faces split along the axis, exactly at the seams); past 64 segments refused, never a looser fit.
 * Null for a spur gear. (An internal gear's hole twists by its space gear's, R12b.2a.)
 */
export function helixTwist(spec: SpurGearSpec, g: ReturnType<typeof spurGearDimensions>, tol: number): { twist: ProfileTwist; helix: NonNullable<SpurGearReport['helix']> } | null {
  if (g.beta === 0) return null;
  const angle = spec.faceWidthMM * Math.tan(g.beta) / g.r;
  let K = 1; while (twistDeviation(Math.abs(angle) / K) * g.ra > tol && K <= 4 * MAX_SEGMENTS) K++;
  const S = Math.ceil(K / 4), N = Math.ceil(K / S), dev = twistDeviation(Math.abs(angle) / (S * N)) * g.ra;
  if (S > MAX_SEGMENTS || dev > tol) throw new GearError('PROFILE_BUDGET_EXCEEDED', `the twist of ${(angle * 180 / Math.PI).toFixed(2)}° over the face needs more than ${MAX_SEGMENTS} axial segments to stay within ${tol} mm`);
  return { twist: { angle, segments: S, pieces: N }, helix: { normalModuleMM: g.mn, transverseModuleMM: g.mt, transversePressureAngleDeg: g.alpha * 180 / Math.PI, helixAngleDeg: spec.helixAngleDeg!, hand: g.beta > 0 ? 'right' : 'left',
    leadMM: 2 * Math.PI * g.r / Math.tan(Math.abs(g.beta)), twistDegrees: angle * 180 / Math.PI, twistDeviationMM: dev, axialSegments: S, piecesPerSegment: N } };
}
/** A feature id made safe for B-rep entity ids. */
export const safeId = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, '_').replace(/^(?=[^A-Za-z_])/, '_');

/** A twist along the depth: the profile turned by `angle` (radians) from bottom to top, in `segments` faces along the axis, each `pieces` cubic pieces. */
export interface ProfileTwist { readonly angle: number; readonly segments: number; readonly pieces: number }

/**
 * A closed plane profile (z 0; its curves counter-clockwise, a hole's clockwise) pulled from z 0 through `depth`:
 * each curve a side face of its name, `<id>.face0`/`.face1` the end faces (their planes reaching `R` about the origin).
 * With a `twist` (helical gears, R6a.5c) the outer profile turns as it rises: each side face the curve turned by A(v),
 * a cubic Hermite fit of the rotation e^{iθ(v)} (exact at the piece ends, so the faces of neighbouring axial segments
 * meet on the exactly turned curve), its deviation measured by `twistDeviation`; segment j's faces are named `#k.j`
 * after the first. The holes do not turn — unless `twistHole`, when only the hole does (an internal gear's teeth). With a `shear` (helical racks) the profile slides along +X by shear × z as it
 * rises: planar faces still, exactly.
 */
export function extrudedProfile(id: string, family: string, outerPieces: readonly { name: string; curve: Curve }[], innerPieces: readonly { name: string; curve: Curve }[], depth: number, R: number, twist?: ProfileTwist, shear = 0, twistHole = false): Brep {
  const vertices: { id: string; point: Point }[] = [], edges: { id: string; curve: Curve; vertices: [string, string] }[] = [], faces: BrepFaceInput[] = [];
  // (`twistHole`: the hole turns and the outer loop does not — an internal gear's teeth inside a plain rim, R12b.2a.)
  const turn = twist && twist.angle ? twist : undefined;
  const outer = ring(id, 'o', outerPieces, depth, twistHole ? undefined : turn, shear, vertices, edges, faces), hole = innerPieces.length ? ring(id, 'h', innerPieces, depth, twistHole ? turn : undefined, shear, vertices, edges, faces) : null;
  const z0 = 0, z1 = depth;
  const plane = (z: number, up: boolean, sid: string): Surface => ({ kind: 'surface', id: sid, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
    controlPoints: up ? [[[-R, -R, z], [-R, R, z]], [[R, -R, z], [R, R, z]]] : [[[-R, -R, z], [R, -R, z]], [[-R, R, z], [R, R, z]]], weights: [[1, 1], [1, 1]] });
  const loops = (uses: string[], up: boolean) => up ? uses.map(edge => ({ edge, sense: 'forward' as const })) : [...uses].reverse().map(edge => ({ edge, sense: 'reversed' as const }));
  faces.push({ id: `${id}_face0`, name: `${id}.face0`, surface: plane(z0, false, `${id}_p0`), sense: 'forward', loops: [{ kind: 'outer', uses: loops(outer.bottom, false) }, ...(hole ? [{ kind: 'inner' as const, uses: loops(hole.bottom, false) }] : [])] });
  faces.push({ id: `${id}_face1`, name: `${id}.face1`, surface: plane(z1, true, `${id}_p1`), sense: 'forward', loops: [{ kind: 'outer', uses: loops(outer.top, true) }, ...(hole ? [{ kind: 'inner' as const, uses: loops(hole.top, true) }] : [])] });
  return buildBrep({ source: { family, id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_shell`, faces, closed: true }] }] });
}

/** The rotation's Hermite fit over [θa, θb] in `pieces` cubic pieces: 3N + 1 (cos, sin) coefficients (not unit between the ends). */
function rotationPoles(a: number, b: number, pieces: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < pieces; k++) {
    const ta = a + (b - a) * k / pieces, tb = a + (b - a) * (k + 1) / pieces, h = (tb - ta) / 3, ca = Math.cos(ta), sa = Math.sin(ta), cb = Math.cos(tb), sb = Math.sin(tb);
    if (k === 0) out.push([ca, sa]);
    // e^{iθ}(1 ± i h): the end tangents iθ' e^{iθ} scaled by a third of the step.
    out.push([ca - h * sa, sa + h * ca], [cb + h * sb, sb - h * cb], [cb, sb]);
  }
  return out;
}
/** The largest distance, per unit radius, of the Hermite rotation fit (one piece over `step` radians) from the rotation. */
export function twistDeviation(step: number): number {
  const P = rotationPoles(0, step, 1);
  let worst = 0;
  for (let i = 0; i <= 64; i++) {
    const t = i / 64, u = 1 - t, c = u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0], s = u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1];
    worst = Math.max(worst, Math.hypot(c - Math.cos(step * t), s - Math.sin(step * t)));
  }
  return worst;
}
const turnPoint = (p: Point, c: number, s: number, z: number): Point => [c * p[0] - s * p[1], s * p[0] + c * p[1], z];
const slid = (p: Point, shear: number): Point => shear ? [p[0] + shear * p[2], p[1], p[2]] : p;

/**
 * One closed loop's side faces between z 0 and `depth` — straight, or turning (`twist`: in its axial segments) — their
 * edges at every level, and the edge uses of the bottom and top levels (for the end faces).
 */
function ring(id: string, tag: string, list: readonly { name: string; curve: Curve }[], depth: number, twist: ProfileTwist | undefined, shear: number, vertices: { id: string; point: Point }[], edges: { id: string; curve: Curve; vertices: [string, string] }[], faces: BrepFaceInput[]): { bottom: string[]; top: string[] } {
  const n = list.length, S = twist ? twist.segments : 1, N = twist ? twist.pieces : 1, levels: string[][] = [];
  const angleAt = (j: number) => twist ? twist.angle * j / S : 0, zAt = (j: number) => depth * j / S;
  const V = (i: number, j: number) => `${id}_${tag}${i}${j === 0 ? 'b' : j === S ? 't' : `l${j}`}`;
  for (let j = 0; j <= S; j++) {
    const c = Math.cos(angleAt(j)), s = Math.sin(angleAt(j)), z = zAt(j), level: string[] = [];
    list.forEach((p, i) => vertices.push({ id: V(i, j), point: slid(turnPoint(p.curve.controlPoints[0], c, s, z), shear) }));
    list.forEach((p, i) => {
      const eid = j === 0 ? `${id}_${tag}${i}eb` : j === S ? `${id}_${tag}${i}et` : `${id}_${tag}${i}el${j}`;
      edges.push({ id: eid, curve: { ...p.curve, id: `${eid}c`, controlPoints: p.curve.controlPoints.map(q => slid(turnPoint(q, c, s, z), shear)) }, vertices: [V(i, j), V((i + 1) % n, j)] });
      level.push(eid);
    });
    levels.push(level);
  }
  for (let j = 0; j < S; j++) {
    const za = zAt(j), zb = zAt(j + 1), rot = twist ? rotationPoles(angleAt(j), angleAt(j + 1), N) : null;
    const zs = rot ? rot.map((_, k) => za + (zb - za) * k / (rot.length - 1)) : [za, zb];
    const knotsV = rot ? bezierKnots(N) : [0, 0, 1, 1], degreeV = rot ? 3 : 1;
    // (A cubic Bézier chain's control z's evenly spaced: z exactly linear in v.)
    const side = (p: Point, k: number): Point => rot ? turnPoint(p, rot[k][0], rot[k][1], zs[k]) : [p[0] + shear * zs[k], p[1], zs[k]];
    list.forEach((p, i) => {
      const s0 = p.curve.controlPoints[0], eid = S === 1 ? `${id}_${tag}${i}ev` : `${id}_${tag}${i}ev${j}`;
      edges.push({ id: eid, curve: { kind: 'curve', id: `${eid}c`, degree: degreeV, knots: knotsV, controlPoints: zs.map((_, k) => side(s0, k)), weights: zs.map(() => 1) }, vertices: [V(i, j), V(i, j + 1)] });
    });
    list.forEach((p, i) => {
      const k1 = (i + 1) % n, ev = (q: number) => S === 1 ? `${id}_${tag}${q}ev` : `${id}_${tag}${q}ev${j}`;
      faces.push({ id: S === 1 ? `${id}_${tag}f${i}` : `${id}_${tag}f${i}_${j}`, name: j === 0 ? p.name : `${p.name}.${j + 1}`,
        surface: { kind: 'surface', id: S === 1 ? `${id}_${tag}s${i}` : `${id}_${tag}s${i}_${j}`, degreeU: p.curve.degree, degreeV, knotsU: [...p.curve.knots], knotsV,
          controlPoints: p.curve.controlPoints.map(q => zs.map((_, k) => side(q, k))), weights: p.curve.weights.map(w => zs.map(() => w)) }, sense: 'forward',
        loops: [{ kind: 'outer', uses: [{ edge: levels[j][i], sense: 'forward' }, { edge: ev(k1), sense: 'forward' }, { edge: levels[j + 1][i], sense: 'reversed' }, { edge: ev(i), sense: 'reversed' }] }] });
    });
  }
  return { bottom: levels[0], top: levels[S] };
}

/**
 * The pair's centre distance with no backlash (R6a.5, D57): unshifted, m(z1 + z2)/2; shifted, a = m(z1 + z2) cos α /
 * (2 cos α_w), with inv α_w = inv α + 2 tan α (x1 + x2)/(z1 + z2) solved by Newton's method (inv is increasing).
 * (Thickness reductions are backlash, not a change of distance.)
 */
function workingDistance(g1: SpurGearSpec, g2: SpurGearSpec, d1: ReturnType<typeof spurGearDimensions>): number {
  // (Transverse: a = m_t(z1 + z2)/2, inv α_wt = inv α_t + 2 tan α_n (x1 + x2)/(z1 + z2) — the spur formulas when β is 0.)
  const z1 = g1.teeth, z2 = g2.teeth, alpha = d1.alpha, aRef = d1.mt * (z1 + z2) / 2, sum = (g1.profileShiftCoefficient ?? 0) + (g2.profileShiftCoefficient ?? 0);
  if (sum === 0) return aRef;
  const target = inv(alpha) + 2 * Math.tan(d1.alphaN) * sum / (z1 + z2);
  if (!(target > 0)) throw new GearError('MATE_INCOMPATIBLE', `shifts summing to ${sum} on ${z1} + ${z2} teeth leave no working pressure angle`);
  let w = alpha;
  for (let i = 0; i < 50; i++) { const f = inv(w) - target, dw = f / (Math.tan(w) ** 2); w -= dw; if (!(w > 0 && w < Math.PI / 2)) throw new GearError('MATE_INCOMPATIBLE', 'no working pressure angle for these shifts'); if (Math.abs(dw) < 1e-15) break; }
  return aRef * Math.cos(alpha) / Math.cos(w);
}
/**
 * Whether two gears mesh as an external parallel pair: the same (normal) module and pressure angle, and helical gears
 * the same helix angle of opposite hands (R6a.5c); else MATE_INCOMPATIBLE.
 */
function compatible(a1: ReturnType<typeof spurGearDimensions>, a2: ReturnType<typeof spurGearDimensions>): void {
  if (a1.mn !== a2.mn) throw new GearError('MATE_INCOMPATIBLE', `modules ${a1.mn} and ${a2.mn} mm do not mesh`);
  if (a1.alphaN !== a2.alphaN) throw new GearError('MATE_INCOMPATIBLE', 'pressure angles differ');
  if (a1.beta !== -a2.beta) throw new GearError('MATE_INCOMPATIBLE', a1.beta === 0 || a2.beta === 0 ? 'a spur gear does not mesh with a helical one' : Math.abs(a1.beta) !== Math.abs(a2.beta) ? 'helix angles differ' : 'two helical gears of the same hand do not mesh on parallel axes (one right, one left)');
}
/** The centre distance at which two gears mesh without backlash (shifted pairs: the working one). */
export function spurGearCenterDistance(g1: SpurGearSpec, g2: SpurGearSpec): number {
  const a1 = spurGearDimensions(g1), a2 = spurGearDimensions(g2);
  compatible(a1, a2);
  return workingDistance(g1, g2, a1);
}

/**
 * A pair's nominal values from the formulas alone (issue #2167 §6): the same module and pressure angle (else
 * MATE_INCOMPATIBLE), centre distance a = m(z1 + z2)/2, the speed ratio −z1/z2, the ideal transverse contact ratio
 * εα = [√(ra1² − rb1²) + √(ra2² − rb2²) − a sin α] / (π m cos α), and the backlash at that centre distance, the sum of
 * the two gears' thickness reductions. Not the pair checks (R6a.4: phase, clearance over a rotation, the usable flank).
 */
export function spurGearPairNominal(g1: SpurGearSpec, g2: SpurGearSpec): { centerDistanceMM: number; speedRatio: number; idealContactRatio: number; axialContactRatio: number; totalContactRatio: number; backlashMM: number } {
  const a1 = spurGearDimensions(g1), a2 = spurGearDimensions(g2);
  compatible(a1, a2);
  const mt = a1.mt, a = workingDistance(g1, g2, a1), alpha = a1.alpha, alphaW = Math.acos(mt * (g1.teeth + g2.teeth) / 2 * Math.cos(alpha) / a);
  const eps = (Math.sqrt(a1.ra ** 2 - a1.rb ** 2) + Math.sqrt(a2.ra ** 2 - a2.rb ** 2) - a * Math.sin(alphaW)) / (Math.PI * mt * Math.cos(alpha));
  // (Helical: the overlap ratio εβ = b sin β / (π m_n), b the narrower face.)
  const epsB = Math.min(g1.faceWidthMM, g2.faceWidthMM) * Math.abs(Math.sin(a1.beta)) / (Math.PI * a1.mn);
  return { centerDistanceMM: a, speedRatio: -g1.teeth / g2.teeth, idealContactRatio: eps, axialContactRatio: epsB, totalContactRatio: eps + epsB, backlashMM: (g1.toothThicknessReductionMM ?? 0) + (g2.toothThicknessReductionMM ?? 0) };
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
  /** Helical (R6a.5c): the overlap ratio εβ = b sin β / (π m_n) over the narrower face, and εγ = the usable εα + εβ (spur: 0 and εα). */
  readonly axialContactRatio: number; readonly totalContactRatio: number;
  /** Helical: which way the axial thrust goes, in words (a direction, no load). */
  readonly axialThrust?: string;
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
  // (The same pair, distance, phase and sweep again: the result kept — panels and checks ask often. The face widths are
  // left out of the key: the sweep is in the transverse plane and does not read them; only the axial and total contact
  // ratios do, and those are worked out again for the widths asked. The widths are checked first, as the check would.)
  const d1 = spurGearDimensions(g1); spurGearDimensions(g2);
  const key = JSON.stringify([withoutWidth(g1), withoutWidth(g2), options.centerDistanceMM ?? null, options.relativePhaseDeg ?? 0, options.samples ?? 64, options.mode ?? 'report']);
  let kept = pairCache.get(key);
  if (kept) { pairCache.delete(key); pairCache.set(key, kept); }
  else { kept = pairCheck(g1, g2, options); pairCache.set(key, kept); if (pairCache.size > 64) pairCache.delete(pairCache.keys().next().value!); }
  const epsB = Math.min(g1.faceWidthMM, g2.faceWidthMM) * Math.abs(Math.sin(d1.beta)) / (Math.PI * d1.mn);
  return epsB === kept.axialContactRatio ? kept : { ...kept, axialContactRatio: epsB, totalContactRatio: kept.usableContactRatio + epsB };
}
function withoutWidth(g: SpurGearSpec): Omit<SpurGearSpec, 'faceWidthMM'> { const { faceWidthMM, ...rest } = g; void faceWidthMM; return rest; }
const pairCache = new Map<string, SpurGearPairCheck>();
function pairCheck(g1: SpurGearSpec, g2: SpurGearSpec, options: SpurGearPairOptions): SpurGearPairCheck {
  const a1 = spurGearDimensions(g1), a2 = spurGearDimensions(g2);
  compatible(a1, a2);
  // (Helical pairs in the transverse plane: every section meshes alike, turned along the helix.)
  const m = a1.mt, z1 = g1.teeth, z2 = g2.teeth, alpha = a1.alpha, aRef = m * (z1 + z2) / 2, a0 = workingDistance(g1, g2, a1), a = options.centerDistanceMM ?? a0;
  const epsB = Math.min(g1.faceWidthMM, g2.faceWidthMM) * Math.abs(Math.sin(a1.beta)) / (Math.PI * a1.mn);
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
  // (Each flank from where its involute starts: max(rb, rf) under a schematic root, the form circle or the undercut's crossing under a generated one.)
  const L = a * Math.sin(alphaW), lo1 = Math.sqrt(Math.max(0, a1.rs ** 2 - a1.rb ** 2)), hi1 = Math.sqrt(a1.ra ** 2 - a1.rb ** 2);
  const lo2 = Math.sqrt(Math.max(0, a2.rs ** 2 - a2.rb ** 2)), hi2 = Math.sqrt(a2.ra ** 2 - a2.rb ** 2);
  const start = Math.max(lo1, L - hi2, 0), end = Math.min(hi1, L - lo2, L), usable = Math.max(0, end - start) / (Math.PI * m * Math.cos(alpha));
  // (The thrust: a flank leaning along the helix pushes its mate along the axis — on gear 1 toward +Z when its hand
  // and its turn agree, right-handed and counter-clockwise seen from +Z, or left-handed and clockwise.)
  const helix = { axialContactRatio: epsB, totalContactRatio: usable + epsB, ...(a1.beta ? { axialThrust: `gear 1 (${a1.beta > 0 ? 'right' : 'left'}-handed) driving counter-clockwise seen from +Z is pushed toward ${a1.beta > 0 ? '+Z' : '−Z'} and gear 2 toward ${a1.beta > 0 ? '−Z' : '+Z'}; the other way round when it turns clockwise (a direction, no load)` } : {}) };
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
      idealContactRatio: ideal, usableContactRatio: usable, ...helix, sweep: { samples: N, minimumClearanceMM: crossed ? -0 : least, atDegrees: tAt * 180 / Math.PI, interference: crossed, converged: false, coarseMinimumMM: least }, diagnostics };
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
    idealContactRatio: ideal, usableContactRatio: usable, ...helix, sweep: { samples: N, minimumClearanceMM: refined, atDegrees: tAt * 180 / Math.PI, interference: refined < 0, converged, coarseMinimumMM: coarse.d }, diagnostics };
}

/**
 * A gear's exact outline for the sweep, as one tooth (from root to root, centred on angle 0): the analytic involute at
 * 150 points a flank (chords within about 1e-5 m of it), the arcs at 24.
 */
export function exactProfile(spec: SpurGearSpec, g: ReturnType<typeof spurGearDimensions>): { tooth: Float64Array; z: number } {
  const r0 = g.rs, t0 = Math.sqrt(Math.max(0, (r0 / g.rb) ** 2 - 1)), t1 = Math.sqrt((g.ra / g.rb) ** 2 - 1), F = 150, A = 24, z = spec.teeth, step = 2 * Math.PI / z;
  const psiStart = g.psi - inv(Math.acos(g.rb / r0)), psiTip = g.psi - inv(Math.acos(g.rb / g.ra)), pts: number[] = [], root = g.root;
  const polar = (r: number, ang: number) => { pts.push(r * Math.cos(ang), r * Math.sin(ang)); };
  // Half the root arc before the tooth, the left flank, the tip, the right flank, half the root arc after; a generated
  // root's fillets (the envelope itself, at F points) between the arcs and the flanks.
  if (root) {
    const a0 = Math.PI / z - Math.PI / 2, c0 = Math.cos(a0), s0 = Math.sin(a0);
    for (let i = 0; i <= A / 2; i++) polar(g.rf, -step / 2 + root.phiRoot * i / (A / 2));
    for (let i = 1; i < F; i++) { const p = filletPoint(root, root.phiRoot + (root.phiEnd - root.phiRoot) * i / F); pts.push(c0 * p[0] - s0 * p[1], -(s0 * p[0] + c0 * p[1])); }
  } else {
    for (let i = 0; i <= A / 2; i++) polar(g.rf, -step / 2 + (step / 2 - psiStart) * i / (A / 2));
    if (g.rf < g.rb) polar(g.rb, -g.psi);
  }
  for (let i = 0; i <= F; i++) { const t = t0 + (t1 - t0) * i / F, r = g.rb * Math.sqrt(1 + t * t); polar(r, -g.psi + t - Math.atan(t)); }
  for (let i = 1; i < A; i++) polar(g.ra, -psiTip + 2 * psiTip * i / A);
  for (let i = F; i >= 0; i--) { const t = t0 + (t1 - t0) * i / F, r = g.rb * Math.sqrt(1 + t * t); polar(r, g.psi - t + Math.atan(t)); }
  if (root) {
    const a0 = Math.PI / z - Math.PI / 2, c0 = Math.cos(a0), s0 = Math.sin(a0);
    for (let i = F - 1; i > 0; i--) { const p = filletPoint(root, root.phiRoot + (root.phiEnd - root.phiRoot) * i / F); pts.push(c0 * p[0] - s0 * p[1], s0 * p[0] + c0 * p[1]); }
    for (let i = 0; i <= A / 2; i++) polar(g.rf, step / 2 - root.phiRoot + root.phiRoot * i / (A / 2));
  } else {
    if (g.rf < g.rb) polar(g.rf, g.psi);
    for (let i = 0; i <= A / 2; i++) polar(g.rf, psiStart + (step / 2 - psiStart) * i / (A / 2));
  }
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
  pairs: for (let i = 0; i < sa.length; i += 4) {
    const ax = sa[i], ay = sa[i + 1], bx = sa[i + 2], by = sa[i + 3];
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    for (let j = 0; j < sb.length; j += 4) {
      const cx = sb[j], cy = sb[j + 1], dx = sb[j + 2], dy = sb[j + 3];
      // (Boxes farther apart than the best so far: no nearer pair here, and no crossing.)
      const gx = Math.max(0, Math.min(cx, dx) - x1, x0 - Math.max(cx, dx)), gy = Math.max(0, Math.min(cy, dy) - y1, y0 - Math.max(cy, dy));
      if (gx * gx + gy * gy > best * best) continue;
      // (Crossed: the answer is how deep, whatever else is nearer — the rest of the pairs need not be measured.)
      if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) { if (verdict) return -1; crossed = true; break pairs; }
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
  for (const [X, Y, cx, ra] of [[sa, sb, a, ra2], [sb, sa, 0, ra1]] as const) for (let i = 0, near = -1; i < X.length; i += 2) {
    const px = X[i], py = X[i + 1];
    // (A segment's start is the end of the one before along a run: the same point, the same depth, measured once.)
    if (i >= 2 && px === X[i - 2] && py === X[i - 1]) continue;
    // (Only a point within the other gear's tip circle can be inside it.)
    if ((px - cx) * (px - cx) + py * py >= ra * ra) continue;
    // The nearest segment, the first of the nearest in order (as a walk from the first one finds it); started from the
    // previous point's nearest, which is near, so that most boxes are passed over at once.
    let d = Infinity, side = 0, at = -1;
    if (near >= 0) { d = pointSegment(px, py, Y[near], Y[near + 1], Y[near + 2], Y[near + 3]); at = near; side = orient(Y[near], Y[near + 1], Y[near + 2], Y[near + 3], px, py); }
    for (let j = 0; j < Y.length; j += 4) {
      const gx = Math.max(0, Math.min(Y[j], Y[j + 2]) - px, px - Math.max(Y[j], Y[j + 2])), gy = Math.max(0, Math.min(Y[j + 1], Y[j + 3]) - py, py - Math.max(Y[j + 1], Y[j + 3]));
      if (gx * gx + gy * gy > d * d) continue;
      const e = pointSegment(px, py, Y[j], Y[j + 1], Y[j + 2], Y[j + 3]); if (e < d || (e === d && j < at)) { d = e; at = j; side = orient(Y[j], Y[j + 1], Y[j + 2], Y[j + 3], px, py); }
    }
    near = at;
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
  // (Helical: each gear's section turned along its helix, both taken at the same height — where their faces begin to overlap.)
  const zRef = Math.max(g1.from, g2.from), d1 = spurGearDimensions(g1.spec), d2 = spurGearDimensions(g2.spec);
  const rot1 = g1.rotation + (zRef - g1.from) * Math.tan(d1.beta) / d1.r, rot2 = g2.rotation + (zRef - g2.from) * Math.tan(d2.beta) / d2.r;
  const raw = (rot2 - phi) - (Math.PI - Math.PI / z2) + (rot1 - phi) * z1 / z2;
  // (A phase within a rounding of a whole pitch is 0.)
  let phase = ((raw % pitch) + pitch) % pitch; if (phase < 1e-9 * pitch || pitch - phase < 1e-9 * pitch) phase = 0;
  const phaseDeg = phase * 180 / Math.PI;
  const check = checkSpurGearPair(g1.spec, g2.spec, { ...options, centerDistanceMM: a, relativePhaseDeg: phaseDeg });
  return { ...check, relativePhaseDeg: phaseDeg, faceOverlapMM: overlap };
}
