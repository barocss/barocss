// R12b.2a (D132): internal (ring) gears — the annulus less its tooth spaces, built directly — and the internal pair's
// checks: the same-sense sweep, the involute and trochoid interference conditions, and a radial-insertion sweep for
// trimming (radial assembly).
//
// The ring's tooth spaces are the teeth of a "space gear" (D129): the shifted rack's gear at x2 + 0.25 (addendum
// 1.25 m + x2 m, dedendum m − x2 m), its reference tooth m_t(π/2 + 2 x2 tan α_n) wide plus the ring's thickness
// reduction — so the ring's tip is r − (1 − x2) m, its root r + (1.25 + x2) m (K1's internal addendum (1 − x2) m and
// depth 2.25 m), its spaces the space gear's teeth exactly. The space gear's profile, turned by −π/z so the ring's tooth
// 1 stands on +X, is the ring's hole, clockwise, inside a plain rim; a helical ring's hole turns along its helix (the
// same hand as its space gear; an internal pair is of one hand).
import type { Brep } from '../brep/brep-core.js';
import type { Curve } from '../types.js';
import { gearError, isGearError, inv, spurGearDimensions, spurGearProfile, extrudedProfile, helixTwist, arcCurve, reversed, safeId, exactProfile, segmentsCross, pointSegment, orient, flankPoles, flankDeviation, bezierKnots, envelopeBreaks, envelopePoles, envelopeDeviation, type Envelope, type GearDiagnostic, type SpurGearSpec, type SpurGearReport } from './gear.js';
import type { Point } from '../types.js';

/** Version 0 of the internal gear's inputs (lengths in mm). */
export interface InternalGearSpec {
  /** A straight ring's module; a helical one's `normalModule`, helix angle and hand (its pinion's hand: an internal pair is of one hand). */
  readonly module?: number;
  readonly normalModule?: number;
  readonly helixAngle?: number;
  readonly hand?: 'right' | 'left';
  readonly teeth: number;
  readonly faceWidth: number;
  /** The rim's outer diameter. */
  readonly rimDiameter: number;
  /** 20° only in this stage. */
  readonly pressureAngle?: number;
  /** x2: the tip at r − (1 − x2) m, the spaces 2 x2 m tan α wider; from −0.5 to 0.75. */
  readonly profileShiftCoefficient?: number;
  /** Taken off the ring's teeth at the reference circle (its spaces that much wider): its share of a pair's backlash. */
  readonly toothThicknessReduction?: number;
  /** The largest deviation of a fitted flank from the involute; default 1e-4 m. */
  readonly profileTolerance?: number;
  /** The least rim beyond the root circle; default 1 m (geometry only: not a strength check). */
  readonly minimumRim?: number;
  /**
   * The root (R12b.2b, D133): 'schematic-corner' (the default; internal-gear@0) or 'shaper-cut' (internal-gear@1): the
   * root a pinion-type `cutter` generates — its teeth z0, its shift x0 (default 0; its addendum 1.25 m + x0 m, its tooth
   * m(π/2 + 2 x0 tan α)), its tip radius (default 0.38 m, the basic rack's: an estimate for a cutter's). Straight rings only.
   */
  readonly rootPolicy?: 'schematic-corner' | 'shaper-cut';
  readonly cutter?: { readonly teeth: number; readonly profileShiftCoefficient?: number; readonly tipRadius?: number };
}
export interface InternalGearReport {
  readonly generator: 'internal-gear@0' | 'internal-gear@1';
  readonly dimensions: {
    readonly referenceDiameter: number; readonly baseDiameter: number;
    /** The tip circle (inside) and the root circle (outside), the rim's outer diameter. */
    readonly tipDiameter: number; readonly rootDiameter: number; readonly rimDiameter: number;
    readonly circularPitch: number; readonly spaceWidth: number; readonly toothThickness: number;
  };
  readonly profileShift: number;
  readonly helix?: SpurGearReport['helix'];
  readonly flankPieces: number; readonly profileDeviation: number; readonly profileTolerance: number;
  readonly rootPolicy: 'schematic-corner' | 'shaper-cut'; readonly manufacturingValidated: false;
  /**
   * A shaper-cut root's (R12b.2b): the cutter (teeth, shift, tip radius), the cutting centre distance and pressure angle,
   * the diameter where the ring's involute ends at its root (the fillet's start) and whether the cutter's round crosses
   * the involute there, the fillet's pieces and measured deviation.
   */
  readonly shaperRoot?: { readonly cutterTeeth: number; readonly cutterShift: number; readonly cutterTipRadius: number; readonly cuttingCenterDistance: number; readonly cuttingPressureAngle: number;
    readonly formDiameter: number; readonly crossing: boolean; readonly filletPieces: number; readonly filletDeviation: number };
  readonly diagnostics: readonly GearDiagnostic[];
}

const MIN_SHIFT = -0.5, MAX_SHIFT = 0.75, MAX_FILLET_PIECES = 15, MAX_PIECES = 5;

/**
 * A pinion-type cutter's tip round as it cuts the ring (R12b.2b, D133), in the frame where the space it cuts is centred
 * on +Y: the cutter's centre at (0, a_c), its tooth on +Y from there; as the ring turns φ the cutter turns φ z2/z0, the
 * same way, about its centre. The round's centre at φ 0 is (qx, qy); the pitch point (0, rw2). The ring is touched at
 * the round's point on the line from its centre away from the pitch point (its normal through the instant centre, as
 * the rack's, D129), turned back by −φ. `phiRoot`: the turn at which the round's centre crosses the line of centres
 * (its point on the cutter's tip circle cuts the root circle); `phiEnd`: where the fillet meets the ring's involute.
 */
class ShaperRoot implements Envelope {
  constructor(readonly k: number, readonly ac: number, readonly rw2: number, readonly rho: number, readonly qx: number, readonly qy: number, readonly phiRoot: number, public phiEnd: number) {}
  point(phi: number): [number, number] {
    const pc = phi * this.k, c = Math.cos(pc), s = Math.sin(pc), dy0 = this.qy - this.ac, Qx = c * this.qx - s * dy0, Qy = this.ac + s * this.qx + c * dy0;
    const dx = Qx, dy = Qy - this.rw2, L = Math.hypot(dx, dy), wx = Qx + this.rho * dx / L, wy = Qy + this.rho * dy / L, cr = Math.cos(phi), sr = Math.sin(phi);
    return [cr * wx + sr * wy, -sr * wx + cr * wy];
  }
  /** p′ = Rot(−φ)(w′ − J w); w′ = Q′ + ρ u′, Q′ = k J (Q − C0), u′ = (Q′ − u (u·Q′)) / L. */
  derivative(phi: number): [number, number] {
    const pc = phi * this.k, c = Math.cos(pc), s = Math.sin(pc), dy0 = this.qy - this.ac, Qx = c * this.qx - s * dy0, Qy = this.ac + s * this.qx + c * dy0;
    const dQx = -this.k * (Qy - this.ac), dQy = this.k * Qx, dx = Qx, dy = Qy - this.rw2, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, ud = ux * dQx + uy * dQy;
    const wx = Qx + this.rho * ux, wy = Qy + this.rho * uy, dwx = dQx + this.rho * (dQx - ux * ud) / L, dwy = dQy + this.rho * (dQy - uy * ud) / L;
    const vx = dwx + wy, vy = dwy - wx, cr = Math.cos(phi), sr = Math.sin(phi);
    return [cr * vx + sr * vy, -sr * vx + cr * vy];
  }
}
/** The ring's involute's polar angle at ρ, on the right of the space centred on +Y (its space gear's tooth there, half-angle ψ_s at the base). */
const ringInvoluteAt = (psiS: number, rb: number, rho: number) => Math.PI / 2 - psiS + inv(Math.acos(Math.min(1, rb / rho)));
function filletOff(S: ShaperRoot, phi: number, psiS: number, rb: number): number {
  const p = S.point(phi), r = Math.hypot(p[0], p[1]);
  return r < rb ? NaN : Math.atan2(p[1], p[0]) - ringInvoluteAt(psiS, rb, r);
}
/**
 * The largest tip round a cutter's tooth holds (its centre on the tooth's middle): the round ρ off the flank with its
 * centre at ra0 − ρ, by bisection in ρ on the centre's angle about the cutter's centre (D133).
 */
function largestTipRadius(rb0: number, ra0: number, psi0: number, m: number): number {
  const tTip = Math.sqrt((ra0 / rb0) ** 2 - 1);
  let lo = 0, hi = 0.6 * m;
  for (let i = 0; i < 80; i++) {
    const rho = (lo + hi) / 2, want = ra0 - rho;
    // The offset flank's roll at radius want, by bisection; its angle about the cutter's centre against π/2.
    let a = 0, b = tTip;
    for (let j = 0; j < 80; j++) { const t = (a + b) / 2, ang = -psi0 + t - Math.atan(t), rr = rb0 * Math.sqrt(1 + t * t), be = -psi0 + t, x = rr * Math.cos(ang) - rho * Math.sin(be), y = rr * Math.sin(ang) + rho * Math.cos(be); if (Math.hypot(x, y) < want) a = t; else b = t; }
    const t = (a + b) / 2, ang = -psi0 + t - Math.atan(t), rr = rb0 * Math.sqrt(1 + t * t), be = -psi0 + t, y = rr * Math.sin(ang) + rho * Math.cos(be);
    // (In the tooth's frame centred on +X here: the centre's y below 0 means it crossed the tooth's middle.)
    if (y < 0) lo = rho; else hi = rho;
  }
  return lo;
}
/** A shaper-cut ring's cutting geometry (D133) — the cutter, its distance, the root, the fillet — and the checks the cutter makes. */
interface Shaper { readonly z0: number; readonly x0: number; readonly rho: number; readonly ac: number; readonly alphaC: number; readonly ra0: number; readonly rf: number; readonly S: ShaperRoot; readonly rStart: number; readonly crossing: boolean; readonly thetaJ: number }
function shaperOf(spec: InternalGearSpec, m: number, z2: number, r2: number, rb2: number, ra2: number, psiS: number, alpha: number): Shaper {
  const c = spec.cutter;
  if (!c || !(Number.isInteger(c.teeth) && c.teeth >= 8 && c.teeth <= z2 - 4)) throw gearError('INVALID_INPUT', `a shaper-cut ring needs its cutter's teeth: a whole number from 8 to ${z2 - 4}`);
  const z0 = c.teeth, x0 = c.profileShiftCoefficient ?? 0;
  if (!(Number.isFinite(x0) && x0 >= MIN_SHIFT && x0 <= MAX_SHIFT)) throw gearError('UNSUPPORTED_PROFILE_SHIFT', `the cutter's shift ${x0}: from ${MIN_SHIFT} to ${MAX_SHIFT}`);
  const r0 = m * z0 / 2, rb0 = r0 * Math.cos(alpha), ra0 = r0 + (1.25 + x0) * m, psi0 = m * (Math.PI / 2 + 2 * x0 * Math.tan(alpha)) / (2 * r0) + inv(alpha);
  // (The tip radius: the toolmaker's; by default the basic rack's 0.38 m, or 80% of the largest the cutter's tip holds
  // when that is less — a pinion cutter's 1.25 m addendum leaves a narrow tip. Either way an estimate, said so.)
  const rho = c.tipRadius ?? Math.min(0.38 * m, 0.8 * largestTipRadius(rb0, ra0, psi0, m));
  // The cutting distance, the cutter's tooth filling the ring's space on their pitch circles: z2 (ψ_s − inv α_c) =
  // z0 (ψ0 − inv α_c), so inv α_c = (z2 ψ_s − z0 ψ0)/(z2 − z0); a_c = m (z2 − z0) cos α / (2 cos α_c).
  const target = (z2 * psiS - z0 * psi0) / (z2 - z0);
  if (!(target > 0)) throw gearError('SELF_INTERSECTION', 'the cutter does not fit the ring\'s spaces');
  let w = alpha;
  for (let i = 0; i < 60; i++) { const dw = (inv(w) - target) / (Math.tan(w) ** 2); w -= dw; if (!(w > 0 && w < Math.PI / 2)) throw gearError('SELF_INTERSECTION', 'no cutting pressure angle for this cutter'); if (Math.abs(dw) < 1e-15) break; }
  const ac = m * (z2 - z0) / 2 * Math.cos(alpha) / Math.cos(w), rw2 = ac * z2 / (z2 - z0), rf = ac + ra0;
  // The cutter's own limits, as K1 tabulates them (Table 4.8; the trimming condition reproduces its boundary, D133):
  // fed in radially it must not trim the ring's teeth; and the ring's tips must meet its involute, not below its base.
  const aa0 = Math.acos(rb0 / ra0), aa2 = Math.acos(rb2 / ra2), q = (Math.cos(aa0) / Math.cos(aa2)) ** 2;
  const t1 = Math.asin(Math.sqrt(Math.max(0, (1 - q) / (1 - (z0 / z2) ** 2)))), t2 = Math.asin(Math.sqrt(Math.max(0, (1 / q - 1) / ((z2 / z0) ** 2 - 1))));
  const trim = (t1 + inv(aa0) - inv(w)) - (z2 / z0) * (t2 + inv(aa2) - inv(w));
  if (!(trim >= 0)) throw gearError('TRIMMING_INTERFERENCE', `a ${z0}-tooth cutter fed in radially trims the ${z2}-tooth ring's teeth (K1 Table 4.8's limit): a cutter of fewer teeth, or more ring teeth`);
  const invM = z0 / z2 - (1 - Math.tan(aa2) / Math.tan(w));
  if (!(invM >= 0)) throw gearError('INVOLUTE_INTERFERENCE', `the ring's tips meet a ${z0}-tooth cutter below its base circle: their corners would be cut away (a ring shift x2 > 0, or more cutter teeth)`);
  // The tip round: its centre at ra0 − ρ from the cutter's, ρ off the right flank (the cutter's tooth centred on +Y):
  // on the flank's inward offset, by bisection in the roll.
  const flank = (t: number): [number, number, number, number] => { const a = Math.PI / 2 - psi0 + t - Math.atan(t), rr = rb0 * Math.sqrt(1 + t * t), b = Math.PI / 2 - psi0 + t; return [rr * Math.cos(a), ac + rr * Math.sin(a), Math.sin(b), -Math.cos(b)]; };
  const tTip = Math.sqrt((ra0 / rb0) ** 2 - 1), want = ra0 - rho, offR = (t: number) => { const f = flank(t); return Math.hypot(f[0] - rho * f[2], f[1] - rho * f[3] - ac); };
  if (!(rho > 0 && offR(0) < want && offR(tTip) > want)) throw gearError('INVALID_INPUT', `cutter tip radius ${rho} mm does not fit the cutter's tooth`);
  let lo = 0, hi = tTip;
  for (let i = 0; i < 200 && hi - lo > 1e-15; i++) { const mid = (lo + hi) / 2; if (offR(mid) < want) lo = mid; else hi = mid; }
  const fl = flank((lo + hi) / 2), qx = fl[0] - rho * fl[2], qy = fl[1] - rho * fl[3], tx = fl[0], ty = fl[1];
  if (!(qx > 0)) throw gearError('INVALID_INPUT', `cutter tip radius ${rho} mm: the cutter's two tip rounds meet (at most ${largestTipRadius(rb0, ra0, psi0, m).toFixed(4)} mm for this cutter)`);
  // φRoot: the round's centre on the line of centres (its angle about the cutter's centre π/2); then the turn at which it
  // touches at its tangent point with the flank — the contact normal along the round's radius to it — by a scan and bisection.
  const chi = Math.atan2(qy - ac, qx), k = z2 / z0, phiRoot = (Math.PI / 2 - chi) / k;
  const S = new ShaperRoot(k, ac, rw2, rho, qx, qy, phiRoot, phiRoot);
  const g = (phi: number) => {
    const pc = phi * k, c2 = Math.cos(pc), s2 = Math.sin(pc), Qx = c2 * qx - s2 * (qy - ac), Qy = ac + s2 * qx + c2 * (qy - ac), Tx = c2 * tx - s2 * (ty - ac), Ty = ac + s2 * tx + c2 * (ty - ac);
    return Qx * (Ty - Qy) - (Qy - rw2) * (Tx - Qx);
  };
  let a0 = phiRoot, g0 = g(a0), phiF = NaN;
  const span = 6 * Math.PI / z2;
  for (let i = 1; i <= 3000; i++) { const b = phiRoot - span * i / 3000, gb = g(b); if (Math.sign(gb) !== Math.sign(g0)) { let l = b, h = a0; for (let j = 0; j < 200 && Math.abs(h - l) > 1e-16; j++) { const mid = (l + h) / 2; if (Math.sign(g(mid)) === Math.sign(gb)) l = mid; else h = mid; } phiF = (l + h) / 2; break; } a0 = b; g0 = gb; }
  if (!Number.isFinite(phiF)) throw gearError('SELF_INTERSECTION', 'the cutter\'s round never meets the ring\'s flank');
  S.phiEnd = phiF;
  // Where the fillet meets the ring's involute: at the flank's tangent point, or — the round's envelope crossing the
  // involute first — at the crossing (the involute beyond it cut away).
  let crossing = false, end = phiF;
  const N = 128, offs: number[] = [];
  for (let i = 0; i <= N; i++) offs.push(filletOff(S, phiRoot + (phiF - phiRoot) * i / N, psiS, rb2));
  for (let i = 1; i < N; i++) {
    const v0 = offs[i], v1 = offs[i + 1];
    if (Number.isFinite(v0) && Number.isFinite(v1) && v0 * v1 < 0 && Math.abs(v1) > 1e-10) {
      let l = phiRoot + (phiF - phiRoot) * i / N, h = phiRoot + (phiF - phiRoot) * (i + 1) / N;
      for (let j = 0; j < 200 && Math.abs(h - l) > 1e-16; j++) { const mid = (l + h) / 2; if (filletOff(S, mid, psiS, rb2) * v0 > 0) l = mid; else h = mid; }
      end = (l + h) / 2; crossing = true; break;
    }
  }
  S.phiEnd = end;
  const pe = S.point(end), rStart = Math.hypot(pe[0], pe[1]), p0 = S.point(phiRoot), thetaJ = Math.atan2(p0[1], p0[0]);
  if (!(rStart > ra2)) throw gearError('SELF_INTERSECTION', 'the cutter cuts the ring\'s whole flank away');
  for (let i = 0; i <= 64; i++) { const p = S.point(phiRoot + (end - phiRoot) * i / 64), an = Math.atan2(p[1], p[0]); if (!(an > Math.PI / 2 - Math.PI / z2 && an <= Math.PI / 2 + 1e-12)) throw gearError('SELF_INTERSECTION', 'the cutter cuts through the ring\'s tooth'); }
  void r2;
  return { z0, x0, rho, ac, alphaC: w, ra0, rf, S, rStart, crossing, thetaJ };
}

/** The ring's space gear (D129): the spur machinery's gear at x2 + 0.25 and thickened to the ring's spaces. */
function spaceSpecOf(spec: InternalGearSpec): SpurGearSpec {
  const helical = spec.helixAngle !== undefined && spec.helixAngle !== 0;
  const mn = (helical ? spec.normalModule : spec.module) as number, cb = helical ? Math.cos(spec.helixAngle! * Math.PI / 180) : 1, x2 = spec.profileShiftCoefficient ?? 0;
  // (The shift's extra 0.25 thickens the tooth by 2·0.25·m_t tan α_n; that, less the ring's reduction, is taken off.)
  const red = 0.5 * mn / cb * Math.tan(20 * Math.PI / 180) - (spec.toothThicknessReduction ?? 0);
  return { ...(helical ? { normalModule: spec.normalModule, helixAngle: spec.helixAngle, hand: spec.hand } : { module: spec.module }), teeth: spec.teeth, faceWidth: spec.faceWidth,
    ...(spec.pressureAngle === undefined ? {} : { pressureAngle: spec.pressureAngle }), profileShiftCoefficient: x2 + 0.25, toothThicknessReduction: red, ...(spec.profileTolerance === undefined ? {} : { profileTolerance: spec.profileTolerance }) };
}

/** The ring's dimensions and input checks (refusals thrown, as gearError, in the ring's own terms). */
export function internalGearDimensions(spec: InternalGearSpec): {
  r: number; rb: number; ra: number; rf: number; rim: number; mn: number; mt: number; alpha: number; alphaN: number; beta: number; x: number;
  space: SpurGearSpec; sd: ReturnType<typeof spurGearDimensions>; spaceWidth: number; pitch: number; shaper?: Shaper;
} {
  const z = spec.teeth, x = spec.profileShiftCoefficient ?? 0;
  if (!(Number.isInteger(z) && z >= 8 && z <= 200)) throw gearError('INVALID_INPUT', 'an internal gear takes a whole number of teeth from 8 to 200');
  if (!Number.isFinite(x)) throw gearError('INVALID_INPUT', 'profileShiftCoefficient must be a number');
  if (!(x >= MIN_SHIFT && x <= MAX_SHIFT)) throw gearError('UNSUPPORTED_PROFILE_SHIFT', `an internal gear's profile shift ${x}: from ${MIN_SHIFT} to ${MAX_SHIFT} in this stage`);
  const j = spec.toothThicknessReduction ?? 0;
  if (!(Number.isFinite(j) && j >= 0)) throw gearError('INVALID_INPUT', 'toothThicknessReduction must be a number of mm, 0 or more');
  const space = spaceSpecOf(spec);
  if (!((space.toothThicknessReduction ?? 0) >= 0)) throw gearError('INVALID_INPUT', `a thickness reduction of ${j} mm: at most ${(j + (space.toothThicknessReduction ?? 0)).toFixed(6)} mm in this stage (a quarter of the shift's tan α)`);
  let sd: ReturnType<typeof spurGearDimensions>;
  try { sd = spurGearDimensions(space); }
  catch (cause) {
    if (!(isGearError(cause))) throw cause;
    if (cause.code === 'SELF_INTERSECTION') throw gearError('SELF_INTERSECTION', `the ring's spaces come to a point below its root circle (${z} teeth${x ? `, x = ${x}` : ''})`);
    if (cause.code === 'UNSUPPORTED_PROFILE_SHIFT') throw gearError('UNSUPPORTED_PROFILE_SHIFT', `${z} teeth at x = ${x} are outside this stage`);
    throw cause;
  }
  const r = sd.r, rb = sd.rb, mn = sd.mn, ra = r - (1 - x) * mn;
  const shaperCut = spec.rootPolicy === 'shaper-cut';
  if (spec.rootPolicy !== undefined && spec.rootPolicy !== 'schematic-corner' && !shaperCut) throw gearError('INVALID_INPUT', `root policy ${String(spec.rootPolicy)}: 'schematic-corner' or 'shaper-cut'`);
  if (!shaperCut && spec.cutter !== undefined) throw gearError('INVALID_INPUT', "a cutter belongs to a shaper-cut root (rootPolicy 'shaper-cut')");
  if (shaperCut && sd.beta !== 0) throw gearError('UNSUPPORTED_GEAR_KIND', 'a shaper-cut root on a helical ring is not in this stage: give it the schematic root');
  // The ring's tip must stand on the involute: above its base circle (K1: z2 > 34 unshifted at 20°).
  if (!(ra >= rb)) throw gearError('UNSUPPORTED_PROFILE_SHIFT', `the ring's tip circle Ø${(2 * ra).toFixed(4)} falls inside its base circle Ø${(2 * rb).toFixed(4)} (${z} teeth${x ? ` at x = ${x}` : ''}): a shift of at least x = ${(1 - (r - rb) / mn).toFixed(3)} lifts it`);
  // (A shaper-cut ring's root is the cutter's: a_c + its tip radius ra0, D133.)
  const shaper = shaperCut ? shaperOf(spec, mn, z, r, rb, ra, sd.psi, sd.alpha) : undefined, rf = shaper ? shaper.rf : r + (1.25 + x) * mn;
  const R = spec.rimDiameter / 2, rimMin = spec.minimumRim ?? mn;
  if (!(Number.isFinite(R) && R > 0)) throw gearError('INVALID_INPUT', 'rimDiameter must be a number of mm above 0');
  if (!(R >= rf + rimMin)) throw gearError('RIM_INTERSECTION', `a rim of Ø${spec.rimDiameter} mm leaves less than the ${rimMin} mm rim beyond the root circle (Ø${(2 * rf).toFixed(3)} mm): at least Ø${(2 * (rf + rimMin)).toFixed(3)} (a geometric margin, not a strength check)`);
  return { r, rb, ra, rf, rim: R, mn, mt: sd.mt, alpha: sd.alpha, alphaN: sd.alphaN, beta: sd.beta, x, space, sd, spaceWidth: sd.toothThickness, pitch: sd.circularPitch, ...(shaper ? { shaper } : {}) };
}

/** A curve turned by `a` radians about the origin (z kept). */
function turned(c: Curve, a: number): Curve {
  const co = Math.cos(a), si = Math.sin(a);
  return { ...c, controlPoints: c.controlPoints.map(p => [co * p[0] - si * p[1], si * p[0] + co * p[1], p[2]]) };
}

/**
 * The ring as a solid: its axis along +Z, tooth 1 centred on +X, pulled from z 0 through the face width. Faces
 * `<id>.flankL#k`, `.flankR#k` (tooth k's flanks, clockwise side first), `.tip#k` (the tip arc, inside), `.root#k` (the
 * root arc of the space before tooth k), `.rim#1`/`#2`, `.face0`/`.face1`; a helical ring's along the helix as a
 * helical gear's (`#k.2` …).
 */
export function internalGear(spec: InternalGearSpec, options: { readonly id?: string } = {}): { brep: Brep; report: InternalGearReport } {
  const id = safeId(options.id ?? 'ring'), d = internalGearDimensions(spec), z = spec.teeth;
  if (d.shaper) return shaperCutRing(spec, d, id);
  let prof: ReturnType<typeof spurGearProfile>;
  try { prof = spurGearProfile(d.space); }
  catch (cause) {
    if (isGearError(cause) && cause.code === 'SELF_INTERSECTION') throw gearError('SELF_INTERSECTION', `the ring's teeth come to a point at their tips (${z} teeth)`);
    throw cause;
  }
  // The space gear's pieces, turned by −π/z and named as the ring's: its tooth k is the ring's space before tooth k
  // (`root#k`), its root arc after it the ring's tip k, its right flank the ring's tooth k's left, its left flank the
  // ring's tooth k − 1's right. The hole runs clockwise: the pieces reversed.
  const nameOf = (role: string, k: number) => role === 'tip' ? `${id}.root#${k}` : role === 'root' ? `${id}.tip#${k}` : role === 'flankR' ? `${id}.flankL#${k}` : `${id}.flankR#${k === 1 ? z : k - 1}`;
  const inner = prof.pieces.map(p => ({ name: nameOf(p.role, p.tooth), curve: reversed(turned(p.curve, -Math.PI / z)) })).reverse();
  const rim = [{ name: `${id}.rim#1`, curve: arcCurve('m', d.rim, 0, Math.PI) }, { name: `${id}.rim#2`, curve: arcCurve('m', d.rim, Math.PI, Math.PI) }];
  const h = helixTwist(d.space, d.sd, prof.report.profileTolerance);
  const brep = extrudedProfile(id, 'gear', rim, inner, spec.faceWidth, d.rim + 1, h?.twist, 0, true);
  const report: InternalGearReport = {
    generator: 'internal-gear@0', profileShift: d.x,
    dimensions: { referenceDiameter: 2 * d.r, baseDiameter: 2 * d.rb, tipDiameter: 2 * d.ra, rootDiameter: 2 * d.rf, rimDiameter: 2 * d.rim, circularPitch: d.pitch, spaceWidth: d.spaceWidth, toothThickness: d.pitch - d.spaceWidth },
    ...(h ? { helix: h.helix } : {}), flankPieces: prof.report.flankPieces, profileDeviation: prof.report.profileDeviation, profileTolerance: prof.report.profileTolerance,
    rootPolicy: 'schematic-corner', manufacturingValidated: false,
    diagnostics: [{ code: 'ROOT_TRANSITION_UNVALIDATED', severity: 'warning', message: 'the flanks meet the root arc at a corner: a schematic root, not the one the cutting tool (a pinion-type cutter) generates' }],
  };
  return { brep, report };
}

/**
 * A shaper-cut ring's exact outline for the sweeps (R12b.2b), as `exactProfile`'s: one space centred on angle 0,
 * counter-clockwise from the middle of the tooth before it — the tip arc, the involute out (150 points), the fillet
 * (the envelope itself, 150), the root arc, and their mirrors.
 */
function shaperOutline(d: ReturnType<typeof internalGearDimensions>): { tooth: Float64Array; z: number } {
  const sh = d.shaper!, z = d.space.teeth, step = 2 * Math.PI / z, rb = d.rb, psiS = d.sd.psi, F = 150, A = 24, right: number[] = [];
  const aTip = Math.PI / 2 - psiS + inv(Math.acos(Math.min(1, rb / d.ra))), t0 = Math.sqrt(Math.max(0, (d.ra / rb) ** 2 - 1)), t1 = Math.sqrt((sh.rStart / rb) ** 2 - 1);
  // (In the frame where the space is centred on +Y; turned to 0 at the end.)
  for (let i = 0; i < A / 2; i++) { const a = Math.PI / 2 - step / 2 + (aTip - Math.PI / 2 + step / 2) * i / (A / 2); right.push(d.ra * Math.cos(a), d.ra * Math.sin(a)); }
  for (let i = 0; i <= F; i++) { const t = t0 + (t1 - t0) * i / F, r = rb * Math.sqrt(1 + t * t), a = Math.PI / 2 - psiS + t - Math.atan(t); right.push(r * Math.cos(a), r * Math.sin(a)); }
  for (let i = F - 1; i > 0; i--) { const q = sh.S.point(sh.S.phiRoot + (sh.S.phiEnd - sh.S.phiRoot) * i / F); right.push(q[0], q[1]); }
  for (let i = 0; i <= A / 2; i++) { const a = sh.thetaJ + (Math.PI / 2 - sh.thetaJ) * i / (A / 2); right.push(sh.rf * Math.cos(a), sh.rf * Math.sin(a)); }
  const pts: number[] = [...right];
  for (let i = right.length - 4; i >= 0; i -= 2) pts.push(-right[i], right[i + 1]);
  const out = new Float64Array(pts.length);
  for (let i = 0; i < pts.length; i += 2) { out[i] = pts[i + 1]; out[i + 1] = -pts[i]; }
  return { tooth: out, z };
}
/** A curve mirrored in the y axis (x → −x), its order kept. */
function mirroredY(c: Curve): Curve { return { ...c, controlPoints: c.controlPoints.map(p => [-p[0], p[1], p[2]]) }; }
/**
 * A shaper-cut ring (R12b.2b, D133): each space built in its own frame (centred on +Y) — the ring's involute on its right
 * from the tip circle out to where the fillet starts (C¹ Hermite pieces as a gear's flank), the fillet (the cutter
 * round's envelope, fitted as D130's), the root arc the cutter's tip circle cuts, their mirrors — then the ring's tooth
 * tip arc to the next space; turned into place, reversed into the clockwise hole. Names as the schematic ring's, the
 * fillets `filletR#k` / `filletL#k` (by the ring's tooth k beside them; later faces `filletR2#k`).
 */
function shaperCutRing(spec: InternalGearSpec, d: ReturnType<typeof internalGearDimensions>, id: string): { brep: Brep; report: InternalGearReport } {
  const sh = d.shaper!, z = spec.teeth, rb = d.rb, psiS = d.sd.psi, tol = spec.profileTolerance ?? 1e-4 * d.mn;
  if (!(Number.isFinite(tol) && tol > 0)) throw gearError('INVALID_INPUT', 'profileTolerance must be a number of mm above 0');
  // The involute, as few pieces as the tolerance asks (at most five), from the tip circle to the fillet's start.
  const t0 = Math.sqrt(Math.max(0, (d.ra / rb) ** 2 - 1)), t1 = Math.sqrt((sh.rStart / rb) ** 2 - 1);
  let N = 1, dev = flankDeviation(rb, t0, t1, 1);
  while (dev > tol && N < MAX_PIECES) dev = flankDeviation(rb, t0, t1, ++N);
  if (dev > tol) throw gearError('PROFILE_BUDGET_EXCEEDED', `a ring flank within ${tol} mm of the involute needs more than ${MAX_PIECES} cubic pieces`);
  let NF = 1, breaks = envelopeBreaks(sh.S, 1), fdev = envelopeDeviation(sh.S, breaks);
  while (fdev > tol && NF < MAX_FILLET_PIECES) { breaks = envelopeBreaks(sh.S, ++NF); fdev = envelopeDeviation(sh.S, breaks); }
  if (fdev > tol) throw gearError('PROFILE_BUDGET_EXCEEDED', `a ring fillet within ${tol} mm of the cutter's envelope needs more than ${MAX_FILLET_PIECES} cubic pieces`);
  const faces = Math.ceil(NF / MAX_PIECES), crv = (P: Point[], n: number): Curve => ({ kind: 'curve', id: 'q', degree: 3, knots: bezierKnots(n), controlPoints: P, weights: P.map(() => 1) });
  // One space's pieces, its frame (counter-clockwise round the ring's centre): right involute out, right fillet out,
  // root, left fillet in, left involute in, the tip arc to the next space.
  const invR = crv(flankPoles(rb, t0, t1, N, Math.PI / 2 - psiS, false), N), filR: Curve[] = [];
  for (let j = 0; j < faces; j++) { const j0 = Math.round(NF * j / faces), j1 = Math.round(NF * (j + 1) / faces); filR.push(reversed(crv(envelopePoles(sh.S, breaks, j0, j1), j1 - j0))); }
  filR.reverse();
  const half = Math.PI / 2 - sh.thetaJ, root = arcCurve('r', sh.rf, sh.thetaJ, 2 * half), aTip = Math.PI / 2 - psiS + inv(Math.acos(Math.min(1, rb / d.ra)));
  const tipFrom = Math.PI - aTip, step = 2 * Math.PI / z, tip = arcCurve('t', d.ra, tipFrom, aTip + step - tipFrom);
  const pieces: { name: string; curve: Curve }[] = [];
  for (let k = 1; k <= z; k++) {
    // Space k sits before tooth k (tooth 1 on +X): centred at 2π(k − 1)/z − π/z; its frame's +Y turned there.
    const turn = step * (k - 1) - Math.PI / z - Math.PI / 2, prev = k === 1 ? z : k - 1;
    pieces.push({ name: `${id}.flankR#${prev}`, curve: turned(invR, turn) });
    filR.forEach((c, j) => pieces.push({ name: `${id}.filletR${faces - j > 1 ? faces - j : ''}#${prev}`, curve: turned(c, turn) }));
    pieces.push({ name: `${id}.root#${k}`, curve: turned(root, turn) });
    [...filR].reverse().forEach((c, j) => pieces.push({ name: `${id}.filletL${j ? j + 1 : ''}#${k}`, curve: turned(reversed(mirroredY(c)), turn) }));
    pieces.push({ name: `${id}.flankL#${k}`, curve: turned(reversed(mirroredY(invR)), turn) });
    pieces.push({ name: `${id}.tip#${k}`, curve: turned(tip, turn) });
  }
  const inner = pieces.map(p => ({ name: p.name, curve: reversed(p.curve) })).reverse();
  const rim = [{ name: `${id}.rim#1`, curve: arcCurve('m', d.rim, 0, Math.PI) }, { name: `${id}.rim#2`, curve: arcCurve('m', d.rim, Math.PI, Math.PI) }];
  const brep = extrudedProfile(id, 'gear', rim, inner, spec.faceWidth, d.rim + 1);
  const report: InternalGearReport = {
    generator: 'internal-gear@1', profileShift: d.x,
    dimensions: { referenceDiameter: 2 * d.r, baseDiameter: 2 * d.rb, tipDiameter: 2 * d.ra, rootDiameter: 2 * d.rf, rimDiameter: 2 * d.rim, circularPitch: d.pitch, spaceWidth: d.spaceWidth, toothThickness: d.pitch - d.spaceWidth },
    flankPieces: N, profileDeviation: dev, profileTolerance: tol, rootPolicy: 'shaper-cut', manufacturingValidated: false,
    shaperRoot: { cutterTeeth: sh.z0, cutterShift: sh.x0, cutterTipRadius: sh.rho, cuttingCenterDistance: sh.ac, cuttingPressureAngle: sh.alphaC * 180 / Math.PI, formDiameter: 2 * sh.rStart, crossing: sh.crossing, filletPieces: NF, filletDeviation: fdev },
    diagnostics: spec.cutter?.tipRadius === undefined ? [{ code: 'ROOT_TRANSITION_UNVALIDATED', severity: 'warning', message: `the cutter's tip radius ${sh.rho.toFixed(4)} mm is an estimate for a pinion-type cutter's (the basic rack's 0.38 m, or 80% of the largest its tooth holds): give the toolmaker's` }] : [],
  };
  return { brep, report };
}

/**
 * Whether a pinion meshes inside the ring: the same (normal) module and pressure angle, both straight or both helical
 * at one angle and of one hand (an internal pair); else MATE_INCOMPATIBLE.
 */
function compatible(p: ReturnType<typeof spurGearDimensions>, d: ReturnType<typeof internalGearDimensions>): void {
  if (p.mn !== d.mn) throw gearError('MATE_INCOMPATIBLE', `modules ${p.mn} and ${d.mn} mm do not mesh`);
  if (p.alphaN !== d.alphaN) throw gearError('MATE_INCOMPATIBLE', 'pressure angles differ');
  if (p.beta !== d.beta) throw gearError('MATE_INCOMPATIBLE', p.beta === 0 || d.beta === 0 ? 'a spur gear does not mesh with a helical ring, nor a helical gear with a straight one' : Math.abs(p.beta) !== Math.abs(d.beta) ? 'helix angles differ' : 'an internal pair is of one hand: the pinion and the ring both right or both left');
}
/**
 * The internal pair's centre distance without backlash: unshifted m_t(z2 − z1)/2; shifted from inv α_w = 2 tan α_n (x2 − x1)/(z2 − z1) + inv α_t
 * (K1's form, reproducing its Table 4.6), a = m_t(z2 − z1) cos α_t / (2 cos α_w), Newton on inv.
 */
export function internalGearCenterDistance(pinion: SpurGearSpec, ring: InternalGearSpec): number {
  const p = spurGearDimensions(pinion), d = internalGearDimensions(ring);
  compatible(p, d);
  return workingDistance(pinion, ring, p, d);
}
function workingDistance(pinion: SpurGearSpec, ring: InternalGearSpec, p: ReturnType<typeof spurGearDimensions>, d: ReturnType<typeof internalGearDimensions>): number {
  const z1 = pinion.teeth, z2 = ring.teeth, dz = z2 - z1, aRef = d.mt * dz / 2, dx = d.x - (pinion.profileShiftCoefficient ?? 0);
  if (!(dz > 0)) throw gearError('MATE_INCOMPATIBLE', `a ${z1}-tooth pinion does not fit inside a ${z2}-tooth ring`);
  if (dx === 0) return aRef;
  const target = 2 * Math.tan(d.alphaN) * dx / dz + inv(d.alpha);
  if (!(target > 0)) throw gearError('MATE_INCOMPATIBLE', `shifts differing by ${dx} on ${z2} − ${z1} teeth leave no working pressure angle`);
  let w = d.alpha;
  for (let i = 0; i < 50; i++) { const dw = (inv(w) - target) / (Math.tan(w) ** 2); w -= dw; if (!(w > 0 && w < Math.PI / 2)) throw gearError('MATE_INCOMPATIBLE', 'no working pressure angle for these shifts'); if (Math.abs(dw) < 1e-15) break; }
  return aRef * Math.cos(d.alpha) / Math.cos(w);
}

export interface InternalGearPairOptions { readonly centerDistance?: number; readonly relativePhase?: number; readonly samples?: number; readonly mode?: 'report' | 'verdict' }
export interface InternalGearPairCheck {
  readonly centerDistance: number; readonly nominalCenterDistance: number;
  readonly workingPressureAngle: number;
  /** The pinion's and the ring's working pitch diameters, 2a z/(z2 − z1). */
  readonly workingPitchDiameters: readonly [number, number];
  /** +z1/z2: the ring turns the same way as the pinion. */
  readonly speedRatio: number;
  /** The ring's space less the pinion's tooth on their working pitch circles; negative: the teeth jam. */
  readonly backlash: number;
  /** The pinion's tip from the ring's root (rf2 − a − ra1), the ring's tip from the pinion's root (ra2 − a − rf1). */
  readonly tipClearances: readonly [number, number];
  /** The formula's [√(ra1² − rb1²) − √(ra2² − rb2²) + a sin α_w]/(π m_t cos α_t), and the path the usable flanks allow. */
  readonly idealContactRatio: number; readonly usableContactRatio: number;
  readonly axialContactRatio: number; readonly totalContactRatio: number;
  /**
   * The interference conditions (derived, D129: K1's are equation images; checked against the sweep): the margins
   * z1/z2 − (1 − tan α_a2 / tan α_w) (involute) and θ1 z1/z2 + inv α_w − inv α_a2 − θ2 (trochoid), each ≥ 0 when clear
   * (Infinity: the tip circles never meet); `formMargin`, along the line of action, from where the pinion's involute starts
 * (its form circle, or max(rb, rf) under a schematic root) to where the ring's tip meets the line — negative when the
 * ring's tip runs below the pinion's involute, where the contact ends (the usable ratio) and the fillet passes it: not
 * a verdict, the sweep is (D132: mostly clear, 24 in 40 crossing); and trimming — the radial-insertion sweep (the
   * pinion moved from the ring's centre out to the working distance along the line of centres, in its meshing phase, its
   * least clearance on the way; `possible` false: its tip circle does not fit inside the ring's) and the trimming
   * condition θ1 + inv α_a1 − inv α_w ≥ (z2/z1)(θ2 + inv α_a2 − inv α_w) (`conditionMargin`: it reproduces K1's Table
   * 4.8, D133). `interference` when either says so (the straight path clears a few small pairs K1's condition does
   * not); `sweepInterference` the path's alone.
   */
  readonly interference: { readonly involuteMargin: number; readonly formMargin: number; readonly trochoidMargin: number; readonly trimming: { readonly possible: boolean; readonly interference: boolean; readonly leastClearance: number; readonly atOffset: number; readonly conditionMargin: number; readonly sweepInterference: boolean } };
  readonly sweep: { readonly samples: number; readonly minimumClearance: number; readonly at: number; readonly interference: boolean; readonly converged: boolean; readonly coarseMinimum: number };
  readonly diagnostics: readonly GearDiagnostic[];
}

/**
 * A pinion inside a ring (R12b.2a): compatibility; the working geometry at the centre distance; backlash, tip
 * clearances, the contact ratio by the formula and by the usable flanks; the interference conditions; the radial
 * insertion; and the two exact outlines swept through one pinion tooth period (the ring turning z1/z2 the same way),
 * the least clearance converged and refined, a crossing measured by its depth — as the external pairs (D55), cached.
 */
export function checkInternalGearPair(pinion: SpurGearSpec, ring: InternalGearSpec, options: InternalGearPairOptions = {}): InternalGearPairCheck {
  const key = JSON.stringify([pinion, ring, options.centerDistance ?? null, options.relativePhase ?? 0, options.samples ?? 64, options.mode ?? 'report']);
  const kept = cache.get(key);
  if (kept) { cache.delete(key); cache.set(key, kept); return kept; }
  const out = pairCheck(pinion, ring, options);
  cache.set(key, out); if (cache.size > 64) cache.delete(cache.keys().next().value!);
  return out;
}
const cache = new Map<string, InternalGearPairCheck>();

/** The sweep's two outlines: the pinion's exact tooth and the ring's (its space gear's tooth: a space), and the windows they need. */
interface Outlines { readonly P: { tooth: Float64Array; z: number }; readonly Q: { tooth: Float64Array; z: number }; readonly ra1: number; readonly ra2: number; readonly m: number; readonly Pa: Float64Array | null; readonly Qa: Float64Array | null }
/**
 * A tooth outline's vertices' polar angles, when they rise along it (the gear star-shaped from its centre, as a schematic
 * root's or a generated one's not undercut); else null.
 */
function anglesOf(P: { tooth: Float64Array }): Float64Array | null {
  const t = P.tooth, out = new Float64Array(t.length / 2);
  for (let i = 0; i < out.length; i++) { out[i] = Math.atan2(t[2 * i + 1], t[2 * i]); if (i && !(out[i] >= out[i - 1] - 1e-15)) return null; }
  return out;
}
/**
 * Whether (px, py) lies inside a star-shaped gear's outline (its tooth `P`, angles `A`) turned θ about (cx, cy): the
 * point's radius against the outline's on the same ray — the tooth's segment there found by bisection on the angles.
 */
function insideStar(P: { tooth: Float64Array; z: number }, A: Float64Array, theta: number, cx: number, cy: number, px: number, py: number): boolean {
  const step = 2 * Math.PI / P.z, dx = px - cx, dy = py - cy, R = Math.hypot(dx, dy);
  let u = Math.atan2(dy, dx) - theta; u -= step * Math.round(u / step);
  let lo = 0, hi = A.length - 1;
  if (u <= A[0]) hi = 1; else if (u >= A[hi]) lo = hi - 1;
  else while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (A[mid] <= u) lo = mid; else hi = mid; }
  // The ray at angle u meets the segment lo → hi at radius ρ: solve along the segment.
  const t = P.tooth, ax = t[2 * lo], ay = t[2 * lo + 1], bx = t[2 * hi], by = t[2 * hi + 1], ux = Math.cos(u), uy = Math.sin(u);
  const den = (bx - ax) * uy - (by - ay) * ux, rho = Math.abs(den) > 1e-300 ? ((bx - ax) * ay - (by - ay) * ax) / den : Math.hypot(ax, ay);
  return R < rho;
}

function pairCheck(pinion: SpurGearSpec, ring: InternalGearSpec, options: InternalGearPairOptions): InternalGearPairCheck {
  const p = spurGearDimensions(pinion), d = internalGearDimensions(ring);
  compatible(p, d);
  const z1 = pinion.teeth, z2 = ring.teeth, m = d.mt, alpha = d.alpha, a0 = workingDistance(pinion, ring, p, d), a = options.centerDistance ?? a0;
  if (!(Number.isFinite(a) && a > 0)) throw gearError('INVALID_INPUT', 'centerDistance must be a number of mm above 0');
  const cw = m * (z2 - z1) / 2 * Math.cos(alpha) / a;
  if (!(cw < 1)) throw gearError('MATE_INCOMPATIBLE', `at ${a} mm no working pressure angle`);
  const alphaW = Math.acos(cw), rw1 = a * z1 / (z2 - z1), rw2 = a * z2 / (z2 - z1);
  // On the working pitch circles: the ring's space 2 rw2 (ψ_s − inv α_w) (ψ_s its space gear's half tooth at the base),
  // the pinion's tooth 2 rw1 (ψ1 − inv α_w).
  const backlash = 2 * rw2 * (d.sd.psi - inv(alphaW)) - 2 * rw1 * (p.psi - inv(alphaW));
  const tips: [number, number] = [d.rf - a - p.ra, d.ra - a - p.rf];
  const L = a * Math.sin(alphaW), hi1 = Math.sqrt(p.ra ** 2 - p.rb ** 2), lo1 = Math.sqrt(Math.max(0, p.rs ** 2 - p.rb ** 2)), ringTip = Math.sqrt(d.ra ** 2 - d.rb ** 2) - L;
  const pb = Math.PI * m * Math.cos(alpha), ideal = (hi1 - ringTip) / pb, usable = Math.max(0, hi1 - Math.max(lo1, ringTip, 0)) / pb;
  const epsB = Math.min(pinion.faceWidth, ring.faceWidth) * Math.abs(Math.sin(d.beta)) / (Math.PI * d.mn);
  // The conditions, transverse, at this distance.
  const aa1 = Math.acos(p.rb / p.ra), aa2 = Math.acos(d.rb / d.ra);
  const involuteMargin = z1 / z2 - (1 - Math.tan(aa2) / Math.tan(alphaW)), formMargin = ringTip - lo1;
  const c1 = (d.ra ** 2 - p.ra ** 2 - a * a) / (2 * a * p.ra), c2 = (a * a + d.ra ** 2 - p.ra ** 2) / (2 * a * d.ra);
  const trochoidMargin = Math.abs(c1) <= 1 && Math.abs(c2) <= 1 ? (Math.acos(c1) + inv(aa1) - inv(alphaW)) * z1 / z2 + inv(alphaW) - inv(aa2) - Math.acos(c2) : Infinity;
  const P1 = exactProfile(pinion, p), Q2 = d.shaper ? shaperOutline(d) : exactProfile(d.space, d.sd), O: Outlines = { P: P1, Q: Q2, ra1: p.ra, ra2: d.ra, m: d.mn, Pa: anglesOf(P1), Qa: anglesOf(Q2) };
  // (Touching is not crossing: the ring's outline is chords of its involutes, which stand into its spaces by up to their
  // sag — rb t δt²/8 at the end of its flank, δt the step in roll — so a pinion on the true involute can seem that far
  // into the ring's material at contact. A crossing no deeper is contact, 0.)
  const phase = (options.relativePhase ?? 0) * Math.PI / 180, verdict = options.mode === 'verdict', touch = chordSag(d.sd) + 1e-9 * d.mn;
  const at = (theta: number) => { const c = clearanceAt(O, theta, theta * z1 / z2 + phase, a, verdict); return c < 0 && c >= -touch ? 0 : c; };
  // (The trimming condition, transverse: with the pinion's and the ring's tip pressure angles and α_w.)
  const qq = (Math.cos(aa1) / Math.cos(aa2)) ** 2, tt1 = Math.asin(Math.sqrt(Math.max(0, (1 - qq) / (1 - (z1 / z2) ** 2)))), tt2 = Math.asin(Math.sqrt(Math.max(0, (1 / qq - 1) / ((z2 / z1) ** 2 - 1))));
  const conditionMargin = (tt1 + inv(aa1) - inv(alphaW)) - (z2 / z1) * (tt2 + inv(aa2) - inv(alphaW));
  const ins = radialInsertion(O, a, phase, touch), trimming = { ...ins, interference: ins.interference || conditionMargin < 0, conditionMargin, sweepInterference: ins.interference };
  const period = 2 * Math.PI / z1, N = Math.max(16, options.samples ?? 64), diagnostics: GearDiagnostic[] = [];
  if (involuteMargin < 0) diagnostics.push({ code: 'INVOLUTE_INTERFERENCE', severity: 'error', message: `involute interference: the ring's tip meets the pinion below its base circle (z1/z2 ${(z1 / z2).toFixed(4)} < 1 − tan α_a2 / tan α_w = ${(z1 / z2 - involuteMargin).toFixed(4)})` });
  if (trochoidMargin < 0) diagnostics.push({ code: 'TROCHOID_INTERFERENCE', severity: 'error', message: `trochoid interference: the pinion's tip strikes the ring's tooth as it leaves the mesh (margin ${trochoidMargin.toFixed(5)} rad; more teeth between them, or a shift, clears it)` });
  if (!trimming.possible) diagnostics.push({ code: 'TRIMMING_INTERFERENCE', severity: 'error', message: `radial assembly impossible: the pinion's tip circle Ø${(2 * p.ra).toFixed(4)} does not fit inside the ring's Ø${(2 * d.ra).toFixed(4)} — assemble it axially` });
  else if (trimming.sweepInterference) diagnostics.push({ code: 'TRIMMING_INTERFERENCE', severity: 'error', message: `trimming interference: moved in radially, the teeth cross ${trimming.atOffset.toFixed(4)} mm from the ring's centre — assemble it axially` });
  else if (conditionMargin < 0) diagnostics.push({ code: 'TRIMMING_INTERFERENCE', severity: 'error', message: `trimming interference by the condition K1 tabulates (margin ${conditionMargin.toFixed(5)}; the straight radial path clears by ${trimming.leastClearance.toFixed(4)} mm) — assemble it axially` });
  const base = { centerDistance: a, nominalCenterDistance: a0, workingPressureAngle: alphaW * 180 / Math.PI, workingPitchDiameters: [2 * rw1, 2 * rw2] as const, speedRatio: z1 / z2, backlash: backlash, tipClearances: tips,
    idealContactRatio: ideal, usableContactRatio: usable, axialContactRatio: epsB, totalContactRatio: usable + epsB, interference: { involuteMargin, formMargin, trochoidMargin, trimming } };
  if (verdict) {
    let least = Infinity, tAt = 0;
    for (let i = 0; i < N; i++) { const t = period * i / N, c = at(t); if (c < least) { least = c; tAt = t; } if (c < 0) break; }
    const crossed = least < 0;
    if (crossed) diagnostics.push({ code: 'SELF_INTERSECTION', severity: 'error', message: `the teeth cross at ${(tAt * 180 / Math.PI).toFixed(4)}° of the pinion (the depth: a report)` });
    return { ...base, sweep: { samples: N, minimumClearance: crossed ? -0 : least, at: tAt * 180 / Math.PI, interference: crossed, converged: false, coarseMinimum: least }, diagnostics };
  }
  let coarse = { c: Infinity, t: 0 }, fine = { c: Infinity, t: 0 };
  for (let i = 0; i < N; i++) { const t = period * i / N, c = at(t); if (c < coarse.c) coarse = { c, t }; }
  for (let i = 0; i < 2 * N; i++) { const t = period * i / (2 * N), c = at(t); if (c < fine.c) fine = { c, t }; }
  const seed = fine.c < coarse.c ? fine : coarse, G = 0.618033988749895;
  let lo = seed.t - period / N, hi = seed.t + period / N, x1 = hi - G * (hi - lo), x2 = lo + G * (hi - lo), f1 = at(x1), f2 = at(x2);
  for (let it = 0; it < 60 && hi - lo > 1e-9; it++) { if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - G * (hi - lo); f1 = at(x1); } else { lo = x1; x1 = x2; f1 = f2; x2 = lo + G * (hi - lo); f2 = at(x2); } }
  const refined = Math.min(seed.c, f1, f2), tAt = f1 < f2 ? x1 : x2, converged = Math.abs(coarse.c - fine.c) <= Math.max(1e-6 * d.mn, 0.02 * Math.abs(refined));
  if (refined < 0) diagnostics.push({ code: 'SELF_INTERSECTION', severity: 'error', message: `the teeth cross by ${(-refined).toFixed(6)} mm at ${(tAt * 180 / Math.PI).toFixed(4)}° of the pinion` });
  if (!converged) diagnostics.push({ code: 'INVALID_INPUT', severity: 'warning', message: `the sweep did not settle (${N} samples: ${coarse.c.toExponential(3)}, ${2 * N}: ${fine.c.toExponential(3)} mm): more samples are needed` });
  if (usable + 1e-12 < ideal) diagnostics.push({ code: 'ROOT_TRANSITION_UNVALIDATED', severity: 'warning', message: `the usable flanks give a contact ratio of ${usable.toFixed(4)}, below the ideal ${ideal.toFixed(4)}` });
  return { ...base, sweep: { samples: N, minimumClearance: refined, at: tAt * 180 / Math.PI, interference: refined < 0, converged, coarseMinimum: coarse.c }, diagnostics };
}

/** The largest sag of the space gear's sampled involute chords (`exactProfile`: 150 steps in roll from where the flank starts to the tip). */
function chordSag(g: ReturnType<typeof spurGearDimensions>): number {
  const t0 = Math.sqrt(Math.max(0, (g.rs / g.rb) ** 2 - 1)), t1 = Math.sqrt((g.ra / g.rb) ** 2 - 1), dt = (t1 - t0) / 150;
  return g.rb * t1 * dt * dt / 8 * 1.01;
}
/**
 * The pinion moved in radially (trimming): its centre from the ring's centre out to a along +X, its tooth on +X in a
 * ring space (the phase given), not turning. Starting concentric needs its tip circle inside the ring's. 48 offsets,
 * the least refined by golden section; a crossing deeper than rounding before the working distance is interference.
 */
function radialInsertion(O: Outlines, a: number, phase: number, touch: number): { possible: boolean; interference: boolean; leastClearance: number; atOffset: number } {
  if (!(O.ra1 < O.ra2)) return { possible: false, interference: true, leastClearance: -0, atOffset: 0 };
  const N = 96, at = (s: number) => { const c = clearanceAt(O, 0, phase, s, false); return c < 0 && c >= -touch ? 0 : c; };
  const c = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) c[i] = at(a * i / N);
  // (Every local least refined by golden section, inside [0, a]: a narrow crossing on the way can hide between samples
  // while the least sample is the working distance itself.)
  let refined = Infinity, where = 0;
  const G = 0.618033988749895;
  for (let i = 0; i <= N; i++) {
    if (!((i === 0 || c[i] <= c[i - 1]) && (i === N || c[i] <= c[i + 1]))) continue;
    if (c[i] < refined) { refined = c[i]; where = a * i / N; }
    if (i === N) continue;
    let lo = Math.max(0, a * (i - 1) / N), hi = Math.min(a, a * (i + 1) / N), x1 = hi - G * (hi - lo), x2 = lo + G * (hi - lo), f1 = at(x1), f2 = at(x2);
    for (let it = 0; it < 40 && hi - lo > 1e-9 * a; it++) { if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - G * (hi - lo); f1 = at(x1); } else { lo = x1; x1 = x2; f1 = f2; x2 = lo + G * (hi - lo); f2 = at(x2); } }
    if (Math.min(f1, f2) < refined) { refined = Math.min(f1, f2); where = f1 < f2 ? x1 : x2; }
  }
  return { possible: true, interference: refined < 0, leastClearance: refined, atOffset: where };
}

/**
 * The least distance between the pinion's outline (about (a, 0), turned θ1 from a tooth on +X) and the ring's (its
 * space gear's outline turned θ2 from a space on +X); negative by the depth when they cross. Only what can meet: the
 * pinion beyond the ring's tip circle, the ring within the pinion's tip circle; distances by a grid of cell m/4.
 */
function clearanceAt(O: Outlines, th1: number, th2: number, a: number, verdict: boolean): number {
  const h = 0.25 * O.m, sa = placed(O.P, th1, a, 0, Math.PI, 0, 0, O.ra2 - 0.5 * O.m, true), sb = placed(O.Q, th2, 0, 0, a > O.ra1 + O.m ? Math.asin((O.ra1 + O.m) / a) + 2 * Math.PI / O.Q.z : Math.PI, a, 0, O.ra1 + 0.5 * O.m, false);
  if (!sa.length || !sb.length) return h;
  const grid = gridOf(sb, h);
  let best = h, crossed = false;
  for (let i = 0; i < sa.length && !crossed; i += 4) {
    const ax = sa[i], ay = sa[i + 1], bx = sa[i + 2], by = sa[i + 3];
    const x0 = Math.floor(Math.min(ax, bx) / h) - 1, x1 = Math.floor(Math.max(ax, bx) / h) + 1, y0 = Math.floor(Math.min(ay, by) / h) - 1, y1 = Math.floor(Math.max(ay, by) / h) + 1;
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
      const list = grid.get(ix * 1000003 + iy); if (!list) continue;
      for (let q = 0; q < list.length; q++) {
        const j = list[q], cx = sb[j], cy = sb[j + 1], dx = sb[j + 2], dy = sb[j + 3];
        if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) { crossed = true; continue; }
        const e = Math.min(pointSegment(ax, ay, cx, cy, dx, dy), pointSegment(bx, by, cx, cy, dx, dy), pointSegment(cx, cy, ax, ay, bx, by), pointSegment(dx, dy, ax, ay, bx, by));
        if (e < best) best = e;
      }
    }
  }
  if (!crossed) return best;
  // The depth (in verdict mode too: a crossing as deep as the ring's chord sag is contact, and only the depth tells): the
  // deepest point of the pinion in the ring's material (right of the ring outline, which runs counter-clockwise round
  // its spaces), or of the ring in the pinion's (left of the pinion's) — each point's side from its nearest segment
  // among the other's segments a module wider than those the clearance kept (its true nearest is within h of it).
  void verdict;
  const wa = placed(O.P, th1, a, 0, Math.PI, 0, 0, O.ra2 - 1.5 * O.m, true), wb = placed(O.Q, th2, 0, 0, a > O.ra1 + O.m ? Math.asin((O.ra1 + 2 * O.m) / a) + 2 * Math.PI / O.Q.z : Math.PI, a, 0, O.ra1 + 1.5 * O.m, false);
  return -Math.max(deepest(sa, wb, gridOf(wb, h), h, -1, O.Qa ? O : null, th2, 0, 0, false), deepest(sb, wa, gridOf(wa, h), h, 1, O.Pa ? O : null, th1, a, 0, true));
}
/**
 * The segments of a gear's teeth (its tooth outline turned θ + 2πk/z about (cx, cy)) whose teeth lie within `window` of
 * the direction `toward` (π: all), kept where an end is beyond (`outside`) or within `reach` of (kx, ky).
 */
function placed(P: { tooth: Float64Array; z: number }, theta: number, cx: number, cy: number, window: number, kx: number, ky: number, reach: number, outside: boolean): Float64Array {
  const out: number[] = [], step = 2 * Math.PI / P.z, t = P.tooth, r2 = reach * reach;
  // (The pinion's teeth face +X at θ 0 about (a, 0); the ring's spaces face +X about the origin: `window` about 0.)
  for (let k = 0; k < P.z; k++) {
    const ang = theta + step * k; let dd = ang; dd -= 2 * Math.PI * Math.round(dd / (2 * Math.PI));
    if (Math.abs(dd) > window) continue;
    const c = Math.cos(ang), s = Math.sin(ang);
    let px = cx + c * t[0] - s * t[1], py = cy + s * t[0] + c * t[1], pk = ((px - kx) * (px - kx) + (py - ky) * (py - ky) >= r2) === outside;
    for (let i = 2; i < t.length; i += 2) {
      const qx = cx + c * t[i] - s * t[i + 1], qy = cy + s * t[i] + c * t[i + 1], qk = ((qx - kx) * (qx - kx) + (qy - ky) * (qy - ky) >= r2) === outside;
      if (pk || qk) out.push(px, py, qx, qy);
      px = qx; py = qy; pk = qk;
    }
  }
  return Float64Array.from(out);
}
/** A uniform grid (cell h) of segments: cell key → the segments' offsets. */
function gridOf(S: Float64Array, h: number): Map<number, number[]> {
  const grid = new Map<number, number[]>();
  for (let j = 0; j < S.length; j += 4) {
    const x0 = Math.floor(Math.min(S[j], S[j + 2]) / h), x1 = Math.floor(Math.max(S[j], S[j + 2]) / h), y0 = Math.floor(Math.min(S[j + 1], S[j + 3]) / h), y1 = Math.floor(Math.max(S[j + 1], S[j + 3]) / h);
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) { const key = ix * 1000003 + iy, list = grid.get(key); if (list) list.push(j); else grid.set(key, [j]); }
  }
  return grid;
}
/**
 * Which side of Y's outline a point lies, by its nearest segment j: the segment's orientation when the nearest point is
 * inside it; at an end shared with the next or previous segment, the vertex's pseudo-normal (the two segments' left
 * normals, unit, summed) — a corner's two lines alone can disagree about a point near it.
 */
function sideOf(Y: Float64Array, j: number, px: number, py: number): number {
  const ax = Y[j], ay = Y[j + 1], bx = Y[j + 2], by = Y[j + 3], ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
  const t = l2 > 0 ? ((px - ax) * ex + (py - ay) * ey) / l2 : 0;
  if (t > 0 && t < 1) return orient(ax, ay, bx, by, px, py);
  const atStart = t <= 0, k = atStart ? j - 4 : j + 4;
  const shared = k >= 0 && k + 3 < Y.length && (atStart ? Y[k + 2] === ax && Y[k + 3] === ay : Y[k] === bx && Y[k + 1] === by);
  if (!shared) return orient(ax, ay, bx, by, px, py);
  const fx = Y[k + 2] - Y[k], fy = Y[k + 3] - Y[k + 1], lf = Math.hypot(fx, fy), le = Math.sqrt(l2), vx = atStart ? ax : bx, vy = atStart ? ay : by;
  // (Left normals (−dy, dx) of both, unit, summed; the point's offset from the vertex along it.)
  return (px - vx) * (-ey / le - fy / lf) + (py - vy) * (ex / le + fx / lf);
}
/**
 * The deepest point of X's segments in Y's material, within 2h: inside the pinion (`pinionSide`) or outside the ring's
 * spaces. Inside or not by the star-shaped outline's ray test when `star` is given (the gear's outline `pinionSide ? P :
 * Q` turned θ about (cx, cy)), else by `side`'s sign of Y's side at the nearest segment; how deep by that segment.
 */
function deepest(X: Float64Array, Y: Float64Array, grid: Map<number, number[]>, h: number, side: number, star: Outlines | null, theta: number, cx: number, cy: number, pinionSide: boolean): number {
  let deep = 0;
  for (let i = 0; i < X.length; i += 2) {
    const px = X[i], py = X[i + 1], ix = Math.floor(px / h), iy = Math.floor(py / h);
    if (star) {
      const inside = pinionSide ? insideStar(star.P, star.Pa!, theta, cx, cy, px, py) : !insideStar(star.Q, star.Qa!, theta, cx, cy, px, py);
      if (!inside) continue;
    }
    let d = Infinity, at = -1;
    for (let gx = ix - 2; gx <= ix + 2; gx++) for (let gy = iy - 2; gy <= iy + 2; gy++) {
      const list = grid.get(gx * 1000003 + gy); if (!list) continue;
      for (let q = 0; q < list.length; q++) { const j = list[q], e = pointSegment(px, py, Y[j], Y[j + 1], Y[j + 2], Y[j + 3]); if (e < d) { d = e; at = j; } }
    }
    if (at < 0) continue;
    if (!star && !(sideOf(Y, at, px, py) * side > 0)) continue;
    if (d > deep) deep = d;
  }
  return deep;
}

/** A ring as it stands: its axis along +Z through `center`, faces from `from` through b, turned by `rotation` (radians; tooth 1 on +X at 0). */
export interface PlacedInternalGear { readonly spec: InternalGearSpec; readonly center: readonly [number, number]; readonly from: number; readonly rotation: number }
export interface PlacedInternalGearPairCheck extends InternalGearPairCheck { readonly relativePhase: number; readonly faceOverlap: number }

/**
 * The pinion's turn inside a ring as placed (R12b.2a): at direction φ from the ring's centre, a pinion tooth on the
 * line of centres in the ring's space there, following the ring's turn by z2/z1 the same way, plus `phase`.
 */
export function pinionTurnInside(ring: PlacedInternalGear, pinionTeeth: number, phi: number, phase: number): number {
  return phi + (ring.rotation - Math.PI / ring.spec.teeth - phi) * ring.spec.teeth / pinionTeeth + phase;
}
/** The pair checks for a pinion inside a ring as placed: the centre distance and the relative phase from where they stand and how they are turned. */
export function checkPlacedInternalGears(ring: PlacedInternalGear, pinion: { readonly spec: SpurGearSpec; readonly center: readonly [number, number]; readonly from: number; readonly rotation: number }, options: Omit<InternalGearPairOptions, 'centerDistance' | 'relativePhase'> = {}): PlacedInternalGearPairCheck {
  const overlap = Math.min(ring.from + ring.spec.faceWidth, pinion.from + pinion.spec.faceWidth) - Math.max(ring.from, pinion.from);
  if (!(overlap > 0)) throw gearError('MATE_INCOMPATIBLE', `the faces do not overlap along the axes (${overlap.toFixed(6)} mm)`);
  const dx = pinion.center[0] - ring.center[0], dy = pinion.center[1] - ring.center[1], a = Math.hypot(dx, dy);
  if (!(a > 0)) throw gearError('MATE_INCOMPATIBLE', 'the pinion stands on the ring\'s axis');
  const phi = Math.atan2(dy, dx), z1 = pinion.spec.teeth, z2 = ring.spec.teeth, pitch = 2 * Math.PI / z2;
  // (Helical: both at the height where their faces begin to overlap, each turned along its helix — of one hand.)
  const zRef = Math.max(ring.from, pinion.from), d = internalGearDimensions(ring.spec), p = spurGearDimensions(pinion.spec);
  const rotR = ring.rotation + (zRef - ring.from) * Math.tan(d.beta) / d.r, rotP = pinion.rotation + (zRef - pinion.from) * Math.tan(p.beta) / p.r;
  // The ring's space gear stands at rotR − π/z2; seen with the pinion on +X, the ring's offset from turning with it.
  const raw = (rotR - Math.PI / z2 - phi) - (rotP - phi) * z1 / z2;
  let phase = ((raw % pitch) + pitch) % pitch; if (phase < 1e-9 * pitch || pitch - phase < 1e-9 * pitch) phase = 0;
  const phaseDeg = phase * 180 / Math.PI;
  const check = checkInternalGearPair(pinion.spec, ring.spec, { ...options, centerDistance: a, relativePhase: phaseDeg });
  return { ...check, relativePhase: phaseDeg, faceOverlap: overlap };
}
