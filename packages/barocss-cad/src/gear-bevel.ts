// R12b.3 (D134): straight bevel gears — the exact spherical involute (D129), standard proportions converging at the
// apex (addendum m, dedendum 1.25 m at the heel: the tip and root cones through the apex), spherical ends.
//
// The gear in its own frame: the apex at the origin, the axis +Z, the teeth on the cone distances Ri = Re − b to Re
// (the toe and the heel), tooth 1 centred on azimuth 0 (+X). On the unit sphere a straight bevel gear's section is one
// outline, the same on every sphere about the apex (the gear is self-similar): the spherical involute of the base cone
// sin δb = sin δ cos α (the trace of a great circle rolling on it; at roll t the point lags the tangent point by the arc
// t sin δb, cos θ = cos δb cos(t sin δb)), the tip and root circles of latitude δ + θa and δ − θf (θa = atan(m/Re),
// θf = atan(1.25 m/Re)), and, where the root lies under the base cone, a meridian join (schematic, flagged).
//
// The flanks are held exactly on their spheres (D129's stereographic lift): conic arcs fitted to the involute's
// stereographic image (projected from the south pole, z = −1; G1, their shoulders on the curve), lifted back by the
// inverse projection — a rational curve of degree 4 exactly on the unit sphere (D129's cubics would lift to degree 6,
// past the kernel's 5) — and the face is the cone through the apex over it (degree 1 along the cone distance): its edges
// on the heel and toe spheres lie on them exactly, those on the tip and root cones are lines through the apex. The only
// inexactness is the flank fit's distance from the involute, measured and reported (at the heel, where it is largest).
// Tip and root faces are cones, the meridian joins planes, the ends spheres (the stereographic map itself, rational
// biquadratic in two Bézier spans a direction: its weights 1 + u² + v² never below 1), the bore a cylinder.
//
// Tredgold's back-cone approximation (the virtual spur gear z_v = z / cos δ) is reported only as the estimate it is.
//
// R12b.4 (D135): spiral bevel gears, the ideal conjugate (D129) — said so wherever a user meets one (`idealModel`, the
// IDEAL_MODEL warning): on every sphere about the apex the section is the straight gear's spherical involute (of the
// transverse pressure angle tan α_t = tan α_n / cos β_m), turned along the cone distance by φ(R) = ±ψ(R) / sin δ, ψ(R)
// the crown-plane angle of a circular tooth trace (the cutter's radius r_c, through the mean point at the mean spiral
// angle β_m). A mate of the other hand turns by −φ z1/z2, so every sphere's pair stays a meshing pair: line contact,
// no crowning, no machine settings — not a face-milled or face-hobbed tooth. The faces are the sections swept by
// R e^{iφ(R)}, a cubic Hermite fit along the cone distance (exact at its knots, its deviation measured), as a helical
// gear's twist.
import { buildBrep, type Brep, type BrepFaceInput } from './brep-core.js';
import type { Curve, Point, Surface } from './types.js';
import { GearError, arcCurve, reversed, safeId, segmentsCross, orient, pointSegment, bezierKnots, type GearDiagnostic } from './gear.js';

/** Version 0 of the straight bevel gear's inputs (lengths in mm, at the heel). */
export interface BevelGearSpec {
  /** The module at the heel (the outer end): the reference diameter there is m × teeth. */
  readonly moduleMM: number;
  readonly teeth: number;
  /** The mating gear's teeth: with the shaft angle they fix the pitch cone, tan δ = sin Σ / (z_mate / z + cos Σ). */
  readonly mateTeeth: number;
  /** The angle between the two axes, above 0 and below 180°; 90° by default. */
  readonly shaftAngleDeg?: number;
  /** Along the cone (heel to toe); below the cone distance (b over R/3 is warned of). */
  readonly faceWidthMM: number;
  /** 20° only. */
  readonly pressureAngleDeg?: number;
  /** 0 only: the Gleason uniform-clearance system's shifts are not built (`UNSUPPORTED_GEAR_KIND`). */
  readonly profileShiftCoefficient?: number;
  /** 'standard' only (addendum m, dedendum 1.25 m, the cones through the apex); 'gleason' refused. */
  readonly system?: 'standard' | 'gleason';
  /** A cylindrical bore on the axis; 0 or left out: none. */
  readonly boreDiameterMM?: number;
  /** The least wall between the bore and the root cone at the toe; the module by default. */
  readonly minimumRimMM?: number;
  /** Thinned at the heel's pitch circle by this much (backlash; scaled along the cone with it). */
  readonly toothThicknessReductionMM?: number;
  /** The flank fit's largest distance from the spherical involute at the heel; 1e-4 m by default. */
  readonly profileToleranceMM?: number;
  /**
   * A spiral bevel gear (R12b.4, D135), the ideal conjugate: its mean spiral angle (above 0, at most 45°), its hand
   * (right: seen from its apex along its axis, the tooth turns clockwise from the toe to the heel) and the radius of
   * the circular tooth trace (the face-mill cutter's). The module is then transverse, at the heel; the pressure angle
   * normal at the mean point. 'epicycloidal' (face-hobbed) traces are refused.
   */
  readonly spiral?: { readonly angleDeg: number; readonly hand: 'right' | 'left'; readonly cutterRadiusMM: number; readonly trace?: 'circular' | 'epicycloidal' };
  /** A hypoid offset: 0 only. */
  readonly offsetMM?: number;
}

export interface BevelGearReport {
  readonly generator: 'bevel-gear@0';
  readonly kind: 'straight' | 'spiral'; readonly system: 'standard'; readonly profile: 'spherical-involute'; readonly ends: 'spherical';
  readonly dimensions: {
    readonly referenceDiameterMM: number; readonly shaftAngleDeg: number; readonly pitchAngleDeg: number; readonly baseConeAngleDeg: number;
    readonly addendumAngleDeg: number; readonly dedendumAngleDeg: number; readonly tipAngleDeg: number; readonly rootAngleDeg: number;
    readonly coneDistanceMM: number; readonly innerConeDistanceMM: number; readonly faceWidthMM: number;
    /** On the heel sphere (not a back cone's): 2 Re sin(δ + θa), 2 Re sin(δ − θf). */
    readonly tipDiameterAtHeelMM: number; readonly rootDiameterAtHeelMM: number;
    readonly circularPitchMM: number; readonly toothThicknessMM: number;
    /** Along the axis from the apex: the nearest point (the toe's tip edge) and the farthest (the heel at the axis or the bore). */
    readonly axialExtentMM: readonly [number, number];
  };
  /** Tredgold's back-cone approximation, an estimate only: the virtual spur gear's teeth z / cos δ. */
  readonly virtualTeeth: number;
  readonly flankPieces: number; readonly flankFaces: number; readonly profileDeviationMM: number; readonly profileToleranceMM: number;
  readonly rootPolicy: 'schematic-meridian'; readonly manufacturingValidated: false;
  /** True for a spiral bevel gear (R12b.4): the ideal conjugate, line contact, not a cut tooth (the IDEAL_MODEL warning says so). */
  readonly idealModel: boolean;
  /** A spiral bevel gear's trace and twist. */
  readonly spiral?: {
    readonly meanSpiralAngleDeg: number; readonly hand: 'right' | 'left'; readonly cutterRadiusMM: number; readonly trace: 'circular'; readonly meanConeDistanceMM: number;
    readonly spiralAngleAtToeDeg: number; readonly spiralAngleAtHeelDeg: number;
    /** The section's (on every sphere) and the normal one it gives at the toe and the heel (tan α_n = tan α_t cos β). */
    readonly transversePressureAngleDeg: number; readonly normalPressureAngleAtToeDeg: number; readonly normalPressureAngleAtHeelDeg: number;
    /** The section's turn from the toe to the heel, φ(Re) − φ(Ri); its fit (cubic pieces along the cone, in axial segments) and the fit's largest distance. */
    readonly twistDeg: number; readonly twistPieces: number; readonly axialSegments: number; readonly twistDeviationMM: number;
  };
  readonly diagnostics: readonly GearDiagnostic[];
}

const ALPHA = 20 * Math.PI / 180, MAX_PIECES = 6, PIECES_PER_FACE = 3, MAX_TEETH = 200, MIN_TEETH = 5, MAX_TWIST_PER_SEGMENT = 5, MAX_SEGMENTS = 16;

/** The roll at which the base cone δb's spherical involute reaches polar angle θ. */
const rollAt = (cb: number, sb: number, th: number) => Math.acos(Math.min(1, Math.cos(th) / cb)) / sb;
/** The spherical involute's point (unit sphere, axis +Z, from the base circle at azimuth 0) at roll t, into `o`. */
function involutePoint(cb: number, sb: number, t: number, o: number[]): void {
  const s = t * sb, cs = Math.cos(s), ss = Math.sin(s), ct = Math.cos(t), st = Math.sin(t);
  o[0] = cs * sb * ct + ss * st; o[1] = cs * sb * st - ss * ct; o[2] = cs * cb;
}
const scratch = [0, 0, 0];
/** The involute's azimuth at polar angle θ. */
function involuteAzimuth(cb: number, sb: number, th: number): number {
  involutePoint(cb, sb, rollAt(cb, sb, th), scratch);
  return Math.atan2(scratch[1], scratch[0]);
}
/** The involute's stereographic image (u, v) at roll t, and its tangent's direction (d/dt over sin(t sin δb) cos δb: defined at t = 0, the cusp). */
function stereoImage(cb: number, sb: number, t: number, o: number[]): void {
  const s = t * sb, cs = Math.cos(s), ss = Math.sin(s), ct = Math.cos(t), st = Math.sin(t);
  const x = cs * sb * ct + ss * st, y = cs * sb * st - ss * ct, z = cs * cb, dx = cb * ct, dy = cb * st, dz = -sb, w = 1 + z;
  o[0] = x / w; o[1] = y / w; o[2] = dx * w - x * dz; o[3] = dy * w - y * dz;
}
/** A conic arc in the stereographic plane: A, the tangents' meeting point P1 (weight w), B. */
interface Conic { readonly A: readonly [number, number]; readonly P1: readonly [number, number]; readonly B: readonly [number, number]; readonly w: number }
const crossing = (cb: number, sb: number, t: number, M: readonly number[], P1: readonly number[], o: number[]) => { stereoImage(cb, sb, t, o); return (P1[0] - M[0]) * (o[1] - M[1]) - (P1[1] - M[1]) * (o[0] - M[0]); };
/**
 * The involute's image over the roll t0 → t1 as N conic arcs (rational quadratic Bézier pieces): each through its ends
 * with the curve's tangents there (P1 where they meet: G1 at the joins), its shoulder on the curve — where the curve
 * crosses the line from the chord's middle to P1, by bisection. (A degree-2 piece lifts to degree 4 on the sphere; a
 * cubic's degree 6 is past the kernel's 5, D134.)
 */
function conicPieces(cb: number, sb: number, t0: number, t1: number, N: number): Conic[] {
  const out: Conic[] = [], a = [0, 0, 0, 0], b = [0, 0, 0, 0], q = [0, 0, 0, 0];
  for (let k = 0; k < N; k++) {
    const ta = t0 + (t1 - t0) * k / N, tb = t0 + (t1 - t0) * (k + 1) / N;
    stereoImage(cb, sb, ta, a); stereoImage(cb, sb, tb, b);
    const det = a[2] * b[3] - a[3] * b[2], rx = b[0] - a[0], ry = b[1] - a[1], l = (rx * b[3] - ry * b[2]) / det, mu = (a[2] * ry - a[3] * rx) / det;
    if (!(l > 0 && mu > 0)) throw new GearError('PROFILE_BUDGET_EXCEEDED', 'a flank piece has no convex conic fit');
    const P1 = [a[0] + l * a[2], a[1] + l * a[3]], M = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let lo = ta, hi = tb; const f0 = crossing(cb, sb, lo, M, P1, q) > 0;
    for (let i = 0; i < 80; i++) { const c = (lo + hi) / 2; if ((crossing(cb, sb, c, M, P1, q) > 0) === f0) lo = c; else hi = c; }
    stereoImage(cb, sb, (lo + hi) / 2, q);
    const w = Math.hypot(q[0] - M[0], q[1] - M[1]) / Math.hypot(P1[0] - q[0], P1[1] - q[1]);
    out.push({ A: [a[0], a[1]], P1: [P1[0], P1[1]], B: [b[0], b[1]], w });
  }
  return out;
}
/** The lifted fit's largest distance from the involute (along the circle of latitude, a bound), on the sphere of radius R. */
function conicDeviation(cb: number, sb: number, C: readonly Conic[], R: number): number {
  let worst = 0;
  for (const P of C) for (let i = 0; i <= 64; i++) {
    const s = i / 64, u = 1 - s, b0 = u * u, b1 = 2 * u * s * P.w, b2 = s * s, W = b0 + b1 + b2;
    const x = (b0 * P.A[0] + b1 * P.P1[0] + b2 * P.B[0]) / W, y = (b0 * P.A[1] + b1 * P.P1[1] + b2 * P.B[1]) / W;
    const q = x * x + y * y, th = Math.acos(Math.max(-1, Math.min(1, (1 - q) / (1 + q))));
    let da = Math.atan2(y, x) - involuteAzimuth(cb, sb, th); if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    worst = Math.max(worst, Math.abs(da) * Math.sin(th) * R);
  }
  return worst;
}

// C(2,i) C(2,k−i) / C(4,k): two quadratics' Bernstein coefficients multiplied, in degree 4.
const PRODUCT: number[][] = [];
for (let k = 0; k <= 4; k++) { const row: number[] = []; for (let i = 0; i <= 2; i++) { const j = k - i; row.push(j < 0 || j > 2 ? 0 : [1, 2, 1][i] * [1, 2, 1][j] / [1, 4, 6, 4, 1][k]); } PRODUCT.push(row); }

/**
 * Conic arcs j0 … j1 in the stereographic plane, turned by `turn` and mirrored in the x axis first when `mirror`,
 * lifted to the unit sphere: per piece, in homogeneous form (U, V, W), the inverse projection (2UW, 2VW, W² − U² − V²) /
 * (W² + U² + V²) in degree 4 by the Bernstein products — a rational curve exactly on the sphere.
 */
function liftedCurve(C: readonly Conic[], j0: number, j1: number, turn: number, mirror: boolean): Curve {
  const c = Math.cos(turn), sn = Math.sin(turn), pts: Point[] = [], wts: number[] = [], knots = [0, 0, 0, 0, 0], n = j1 - j0;
  for (let k = j0; k < j1; k++) {
    const P = C[k], U = [0, 0, 0], V = [0, 0, 0], W = [1, P.w, 1];
    for (let i = 0; i <= 2; i++) { const p = i === 0 ? P.A : i === 1 ? P.P1 : P.B, y = mirror ? -p[1] : p[1]; U[i] = W[i] * (c * p[0] - sn * y); V[i] = W[i] * (sn * p[0] + c * y); }
    for (let e = k === j0 ? 0 : 1; e <= 4; e++) {
      let X = 0, Y = 0, Q = 0, WW = 0;
      for (let i = 0; i <= 2; i++) { const f = PRODUCT[e][i]; if (!f) continue; const j = e - i; X += f * U[i] * W[j]; Y += f * V[i] * W[j]; Q += f * (U[i] * U[j] + V[i] * V[j]); WW += f * W[i] * W[j]; }
      const H = WW + Q;
      if (!(H > 0)) throw new GearError('SELF_INTERSECTION', 'a flank\'s lifted weight is not positive');
      pts.push([2 * X / H, 2 * Y / H, (WW - Q) / H]); wts.push(H);
    }
    if (k < j1 - 1) knots.push(k - j0 + 1, k - j0 + 1, k - j0 + 1, k - j0 + 1);
  }
  knots.push(n, n, n, n, n);
  return { kind: 'curve', id: 'f', degree: 4, knots, controlPoints: pts, weights: wts };
}
/** A circle of latitude on the unit sphere (polar angle θ) from azimuth a0 by sweep (counter-clockwise seen from +Z when > 0). */
function latitudeArc(th: number, a0: number, sweep: number): Curve {
  const c = arcCurve('a', Math.sin(th), a0, sweep), z = Math.cos(th);
  return { ...c, controlPoints: c.controlPoints.map(p => [p[0], p[1], z]) };
}
/** A meridian arc on the unit sphere at azimuth φ from polar θ0 to θ1 (rational quadratic, one span). */
function meridianArc(phi: number, th0: number, th1: number): Curve {
  const h = (th1 - th0) / 2, w = Math.cos(h), m = (th0 + th1) / 2, cp = Math.cos(phi), sp = Math.sin(phi);
  const at = (th: number, r: number): Point => [r * Math.sin(th) * cp, r * Math.sin(th) * sp, r * Math.cos(th)];
  return { kind: 'curve', id: 'm', degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [at(th0, 1), at(m, 1 / w), at(th1, 1)], weights: [1, w, 1] };
}
/**
 * The sphere of radius R as the inverse stereographic map of the square |u|, |v| ≤ a (from the south pole): rational
 * biquadratic, two Bézier spans a direction (knots 0, ½, 1), its weights 1 + u² + v² ≥ 1 (u²'s coefficients a², 0, 0,
 * 0, a²). Its normal points out of the sphere; `inward` swaps u and v (the toe's, toward the apex).
 */
function stereoSphere(sid: string, R: number, a: number, inward: boolean): Surface {
  const U = [-a, -a / 2, 0, a / 2, a], U2 = [a * a, 0, 0, 0, a * a], cp: Point[][] = [], wt: number[][] = [];
  for (let i = 0; i < 5; i++) {
    const row: Point[] = [], wr: number[] = [];
    for (let j = 0; j < 5; j++) {
      const iu = inward ? j : i, iv = inward ? i : j, W = 1 + U2[iu] + U2[iv];
      row.push([R * 2 * U[iu] / W, R * 2 * U[iv] / W, R * (1 - U2[iu] - U2[iv]) / W]); wr.push(W);
    }
    cp.push(row); wt.push(wr);
  }
  const k = [0, 0, 0, 0.5, 0.5, 1, 1, 1];
  return { kind: 'surface', id: sid, degreeU: 2, degreeV: 2, knotsU: k, knotsV: [...k], controlPoints: cp, weights: wt };
}

/** The gear's dimensions and the values the solid and the pair checks need; refusals as typed errors. */
export function bevelGearDimensions(spec: BevelGearSpec) {
  const m = spec.moduleMM, z = spec.teeth, zm = spec.mateTeeth, b = spec.faceWidthMM, SigmaDeg = spec.shaftAngleDeg ?? 90;
  if (!(Number.isFinite(m) && m > 0 && m <= 100)) throw new GearError('INVALID_INPUT', 'moduleMM must be a number of mm above 0, at most 100');
  if (!(Number.isInteger(z) && z >= MIN_TEETH && z <= MAX_TEETH)) throw new GearError('INVALID_INPUT', `teeth must be a whole number from ${MIN_TEETH} to ${MAX_TEETH}`);
  if (!(Number.isInteger(zm) && zm >= MIN_TEETH && zm <= MAX_TEETH)) throw new GearError('INVALID_INPUT', `mateTeeth must be a whole number from ${MIN_TEETH} to ${MAX_TEETH}`);
  if (!(Number.isFinite(SigmaDeg) && SigmaDeg > 0 && SigmaDeg < 180)) throw new GearError('INVALID_INPUT', 'shaftAngleDeg must be above 0 and below 180°');
  if ((spec.pressureAngleDeg ?? 20) !== 20) throw new GearError('UNSUPPORTED_GEAR_KIND', `pressure angle ${spec.pressureAngleDeg}°: only 20° in this stage`);
  if (spec.system !== undefined && spec.system !== 'standard') throw new GearError('UNSUPPORTED_GEAR_KIND', `the ${String(spec.system)} system: only the standard proportions (addendum m, dedendum 1.25 m, the cones through the apex) in this stage — the Gleason uniform-clearance system and its shifts are not built`);
  if ((spec.profileShiftCoefficient ?? 0) !== 0) throw new GearError('UNSUPPORTED_GEAR_KIND', `profile shift ${spec.profileShiftCoefficient}: a bevel gear's shifts belong to the Gleason system, not built in this stage`);
  if ((spec.offsetMM ?? 0) !== 0) throw new GearError('UNSUPPORTED_GEAR_KIND', `an offset of ${spec.offsetMM} mm makes a hypoid pair: not built in this stage`);
  const sp = spec.spiral;
  if (sp !== undefined) {
    if (sp.trace !== undefined && sp.trace !== 'circular') throw new GearError('UNSUPPORTED_GEAR_KIND', `a${sp.trace === 'epicycloidal' ? 'n epicycloidal (face-hobbed)' : ` ${String(sp.trace)}`} tooth trace: only the circular (face-milled) one in this stage`);
    if (!(Number.isFinite(sp.angleDeg) && sp.angleDeg > 0 && sp.angleDeg <= 45)) throw new GearError('INVALID_INPUT', `spiral angle ${sp.angleDeg}°: above 0, at most 45° in this stage`);
    if (sp.hand !== 'right' && sp.hand !== 'left') throw new GearError('INVALID_INPUT', "a spiral bevel gear needs its hand, 'right' or 'left'");
    if (!(Number.isFinite(sp.cutterRadiusMM) && sp.cutterRadiusMM > 0)) throw new GearError('INVALID_INPUT', 'the spiral\'s cutterRadiusMM must be a number of mm above 0');
  }
  // (Spiral: the section's pressure angle is the transverse one at the mean point.)
  const betaM = sp ? sp.angleDeg * Math.PI / 180 : 0, alpha = sp ? Math.atan(Math.tan(ALPHA) / Math.cos(betaM)) : ALPHA;
  const Sigma = SigmaDeg * Math.PI / 180, delta = Math.atan2(Math.sin(Sigma), zm / z + Math.cos(Sigma));
  if (!(delta < Math.PI / 2 - 1e-9)) throw new GearError('UNSUPPORTED_GEAR_KIND', `a pitch angle of ${(delta * 180 / Math.PI).toFixed(4)}°: ${delta < Math.PI / 2 + 1e-9 ? 'a crown gear' : 'an internal bevel gear'} is not built in this stage (below 90° only)`);
  const Re = m * z / (2 * Math.sin(delta));
  if (!(Number.isFinite(b) && b > 0 && b < Re)) throw new GearError('INVALID_INPUT', `faceWidthMM must be above 0 and below the cone distance ${Re.toFixed(4)} mm`);
  const Ri = Re - b, thA = Math.atan(m / Re), thF = Math.atan(1.25 * m / Re), tipPolar = delta + thA, rootPolar = delta - thF;
  if (!(rootPolar > 0)) throw new GearError('SELF_INTERSECTION', `the root cone (${(rootPolar * 180 / Math.PI).toFixed(4)}°) reaches past the axis`);
  const sb = Math.sin(delta) * Math.cos(alpha), deltaB = Math.asin(sb), cb = Math.cos(deltaB);
  // Undercut, by the exact spherical condition (derived here, D134): the generating crown gear (δ = 90°, its base cone
  // 90° − α) reaches from the pitch point along the great circle of action by asin(sin θa / sin α) (its tip cone at
  // 90° + θa, θa = atan(m/Re), its working depth m as the basic rack's); undercut when that passes the gear's base-cone
  // tangent point, acos(cos δ / cos δb) from the pitch point.
  const toBase = Math.acos(Math.min(1, Math.cos(delta) / cb)), reach = Math.asin(Math.min(1, Math.sin(thA) / Math.sin(alpha))), zv = z / Math.cos(delta);
  if (reach > toBase + 1e-12) throw new GearError('UNSUPPORTED_PROFILE_SHIFT', `${z} teeth on a ${(delta * 180 / Math.PI).toFixed(4)}° pitch cone are undercut by the generating crown gear (exact spherical condition: it reaches ${(reach * Re).toFixed(4)} mm along the line of action at the heel, the base cone is ${(toBase * Re).toFixed(4)} mm away); Tredgold's virtual spur gear has ${zv.toFixed(2)} teeth (an estimate: 17.1 and fewer are undercut). A shift (the Gleason system) is not built in this stage: more teeth on this gear, or fewer on its mate`);
  const red = spec.toothThicknessReductionMM ?? 0;
  if (!(Number.isFinite(red) && red >= 0)) throw new GearError('INVALID_INPUT', 'toothThicknessReductionMM must be a number of mm, 0 or more');
  const s = Math.PI * m / 2 - red;
  if (!(s > 0)) throw new GearError('INVALID_INPUT', `a thickness reduction of ${red} mm leaves no tooth (the heel's tooth is ${(Math.PI * m / 2).toFixed(4)} mm)`);
  // Half the tooth's azimuth at the pitch cone s / (2 Re sin δ) = s / (m z), the involute's base point that much plus
  // its own azimuth at δ from the tooth's middle (as a spur gear's s/d + inv α).
  const psiB = s / (m * z) + involuteAzimuth(cb, sb, delta), tipHalf = psiB - involuteAzimuth(cb, sb, tipPolar);
  if (!(tipHalf > 0)) throw new GearError('SELF_INTERSECTION', 'the tooth comes to a point below its tip cone');
  const startPolar = Math.max(deltaB, rootPolar), rootHalf = psiB - (startPolar > deltaB ? involuteAzimuth(cb, sb, startPolar) : 0), step = 2 * Math.PI / z;
  if (!(step - 2 * rootHalf > 1e-9)) throw new GearError('SELF_INTERSECTION', 'neighbouring teeth meet at the root');
  const bd = spec.boreDiameterMM ?? 0, rim = spec.minimumRimMM ?? m;
  if (!(Number.isFinite(bd) && bd >= 0)) throw new GearError('INVALID_INPUT', 'boreDiameterMM must be a number of mm, 0 or more');
  // (The bore within the root cone at the toe, less the rim: the cylinder then meets only the two end spheres.)
  const boreMax = 2 * (Ri * Math.sin(rootPolar) - rim);
  if (bd > 0 && !(bd <= boreMax)) throw new GearError('BORE_INTERSECTION', `a bore of ${bd} mm leaves less than the ${rim} mm rim below the root cone at the toe (Ø${(2 * Ri * Math.sin(rootPolar)).toFixed(3)} mm there): at most Ø${Math.max(0, boreMax).toFixed(3)} (a geometric margin, not a strength check)`);
  const trace = sp ? spiralTrace(Re, Ri, betaM, sp.cutterRadiusMM, sp.hand === 'right' ? 1 : -1, delta) : null;
  return { m, z, zm, b, Sigma, delta, deltaB, sb, cb, Re, Ri, thA, thF, tipPolar, rootPolar, startPolar, psiB, tipHalf, rootHalf, step, red, s, zv, bore: bd / 2, toBase, alpha, trace };
}

/**
 * A circular tooth trace on the crown plane (R12b.4): the apex at the origin, the mean point M at (Rm, 0), the trace
 * through it at the spiral angle β_m to the cone element (its tangent (cos β_m, sin β_m)), its centre C = M + r_c (−sin
 * β_m, cos β_m), the side the trace turns toward — q = |C| from the apex, q² = Rm² + r_c² − 2 Rm r_c sin β_m — so
 * sin β(R) = (R² + r_c² − q²) / (2 R r_c) = (R² − Rm²) / (2 R r_c) + (Rm / R) sin β_m (growing toward the heel on a small
 * cutter, falling on a large one). ψ(R) is the trace's crown angle at the cone distance R (0 at Rm), the branch
 * through M; the gear's section turns by φ(R) = h ψ(R) / sin δ (h +1 right-hand).
 */
export interface SpiralTrace { readonly Rm: number; readonly rc: number; readonly q: number; readonly omegaC: number; readonly branch: number; readonly h: number; readonly sinDelta: number; readonly betaM: number }
function spiralTrace(Re: number, Ri: number, betaM: number, rc: number, h: number, delta: number): SpiralTrace {
  const Rm = (Re + Ri) / 2, Cx = Rm - rc * Math.sin(betaM), Cy = rc * Math.cos(betaM), q = Math.hypot(Cx, Cy), omegaC = Math.atan2(Cy, Cx);
  // (M is at the circle's angle ω_M with (cos, sin) = (sin β_m, −cos β_m); the branch is the side of ω_C it lies on.)
  let d = Math.atan2(-Math.cos(betaM), Math.sin(betaM)) - omegaC; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
  const T: SpiralTrace = { Rm, rc, q, omegaC, branch: d >= 0 ? 1 : -1, h, sinDelta: Math.sin(delta), betaM };
  // (The spiral angle within (0°, 90°) over the whole face, sampled — else the trace turns back or runs along a circle.)
  for (let i = 0; i <= 32; i++) {
    const R = Ri + (Re - Ri) * i / 32, sb = spiralSin(T, R);
    if (!(sb > 1e-6 && sb < 1 - 1e-6)) throw new GearError('INVALID_INPUT', `a cutter radius of ${rc} mm takes the spiral angle to ${sb >= 1 ? '90°' : '0°'} or past it within the face (at ${R.toFixed(4)} mm from the apex): ${sb >= 1 ? 'a larger' : 'another'} cutter radius, or a smaller spiral angle`);
  }
  return T;
}
const spiralSin = (T: SpiralTrace, R: number) => (R * R + T.rc * T.rc - T.q * T.q) / (2 * R * T.rc);
/** The trace's crown angle ψ(R) (0 at the mean point). */
function spiralPsi(T: SpiralTrace, R: number): number {
  const c = Math.max(-1, Math.min(1, (R * R - T.q * T.q - T.rc * T.rc) / (2 * T.rc * T.q))), w = T.omegaC + T.branch * Math.acos(c);
  const x = T.q * Math.cos(T.omegaC) + T.rc * Math.cos(w), y = T.q * Math.sin(T.omegaC) + T.rc * Math.sin(w);
  return Math.atan2(y, x);
}
/** The section's turn φ(R) = h ψ(R) / sin δ and its rate dφ/dR = h tan β(R) / (R sin δ). */
const spiralPhi = (T: SpiralTrace, R: number) => T.h * spiralPsi(T, R) / T.sinDelta;
function spiralPhiRate(T: SpiralTrace, R: number): number { const sb = spiralSin(T, R); return T.h * sb / Math.sqrt(1 - sb * sb) / (R * T.sinDelta); }

/**
 * G(R) = R e^{iφ(R)} as cubic Hermite pieces over [R0, R1] (N pieces): 3N + 1 complex poles [x, y] (G' = e^{iφ}(1 + i R φ')),
 * exact at the piece ends.
 */
function twistPoles(T: SpiralTrace, R0: number, R1: number, N: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < N; k++) {
    const ra = R0 + (R1 - R0) * k / N, rb = R0 + (R1 - R0) * (k + 1) / N, h = (rb - ra) / 3;
    const pa = spiralPhi(T, ra), pb = spiralPhi(T, rb), ka = ra * spiralPhiRate(T, ra), kb = rb * spiralPhiRate(T, rb);
    const ca = Math.cos(pa), sa = Math.sin(pa), cb = Math.cos(pb), sb = Math.sin(pb);
    if (k === 0) out.push([ra * ca, ra * sa]);
    // e^{iφ}(1 + iκ): (cos − κ sin, sin + κ cos).
    out.push([ra * ca + h * (ca - ka * sa), ra * sa + h * (sa + ka * ca)], [rb * cb - h * (cb - kb * sb), rb * sb - h * (sb + kb * cb)], [rb * cb, rb * sb]);
  }
  return out;
}
/** The fit's largest distance from R e^{iφ(R)} (the points it moves lie within the unit circle's span: a bound on the faces' distance). */
function twistDeviation(T: SpiralTrace, R0: number, R1: number, N: number): number {
  const G = twistPoles(T, R0, R1, N);
  let worst = 0;
  for (let k = 0; k < N; k++) for (let i = 0; i <= 32; i++) {
    const s = i / 32, u = 1 - s, a = G[3 * k], b = G[3 * k + 1], c = G[3 * k + 2], d = G[3 * k + 3], R = R0 + (R1 - R0) * (k + s) / N, ph = spiralPhi(T, R);
    const x = u * u * u * a[0] + 3 * u * u * s * b[0] + 3 * u * s * s * c[0] + s * s * s * d[0], y = u * u * u * a[1] + 3 * u * u * s * b[1] + 3 * u * s * s * c[1] + s * s * s * d[1];
    worst = Math.max(worst, Math.hypot(x - R * Math.cos(ph), y - R * Math.sin(ph)));
  }
  return worst;
}
export type BevelGearDimensions = ReturnType<typeof bevelGearDimensions>;

interface Side { readonly name: string; readonly curve: Curve }
/** Where a loop's curves stand at the toe and the heel: the unit-sphere outline scaled (a cone through the apex), or a z-0 circle lifted (the bore). */
interface Level { readonly scale: number; readonly z: number | null }
const atLevel = (p: Point, L: Level): Point => L.z === null ? [p[0] * L.scale, p[1] * L.scale, p[2] * L.scale] : [p[0], p[1], L.z];

/** One loop's side faces from the toe to the heel (ruled, degree 1 across), their edges, and the edge uses at each end. */
function sideRing(id: string, tag: string, list: readonly Side[], toe: Level, heel: Level, vertices: { id: string; point: Point }[], edges: { id: string; curve: Curve; vertices: [string, string] }[], faces: BrepFaceInput[]): { toe: string[]; heel: string[] } {
  const n = list.length, V = (i: number, e: 't' | 'h') => `${id}_${tag}${i}${e}`, ends = { toe: [] as string[], heel: [] as string[] };
  for (const [e, L, out] of [['t', toe, ends.toe], ['h', heel, ends.heel]] as const) {
    list.forEach((p, i) => vertices.push({ id: V(i, e), point: atLevel(p.curve.controlPoints[0], L) }));
    list.forEach((p, i) => {
      const eid = `${id}_${tag}${i}e${e}`;
      edges.push({ id: eid, curve: { ...p.curve, id: `${eid}c`, controlPoints: p.curve.controlPoints.map(q => atLevel(q, L)) }, vertices: [V(i, e), V((i + 1) % n, e)] });
      out.push(eid);
    });
  }
  list.forEach((p, i) => {
    const eid = `${id}_${tag}${i}ev`, a = atLevel(p.curve.controlPoints[0], toe), b = atLevel(p.curve.controlPoints[0], heel);
    edges.push({ id: eid, curve: { kind: 'curve', id: `${eid}c`, degree: 1, knots: [0, 0, 1, 1], controlPoints: [a, b], weights: [1, 1] }, vertices: [V(i, 't'), V(i, 'h')] });
  });
  list.forEach((p, i) => {
    const k1 = (i + 1) % n;
    faces.push({ id: `${id}_${tag}f${i}`, name: p.name, sense: 'forward',
      surface: { kind: 'surface', id: `${id}_${tag}s${i}`, degreeU: p.curve.degree, degreeV: 1, knotsU: [...p.curve.knots], knotsV: [0, 0, 1, 1],
        controlPoints: p.curve.controlPoints.map(q => [atLevel(q, toe), atLevel(q, heel)]), weights: p.curve.weights.map(w => [w, w]) },
      loops: [{ kind: 'outer', uses: [{ edge: ends.toe[i], sense: 'forward' }, { edge: `${id}_${tag}${k1}ev`, sense: 'forward' }, { edge: ends.heel[i], sense: 'reversed' }, { edge: `${id}_${tag}${i}ev`, sense: 'reversed' }] }] });
  });
  return ends;
}

/**
 * One loop's side faces turned along the cone (R12b.4): in `S` segments between the levels R_j (Ri … Re), each face the
 * loop's unit-sphere curve swept by G(R) = R e^{iφ(R)} — (Re G p̂, Im G p̂, R p_z), p̂ = p_x + i p_y — G a cubic Hermite
 * fit of `N` pieces a segment (exact at the levels, so the faces of neighbouring segments meet on the exactly turned
 * curve, and the ends lie on their spheres exactly). Segment j's faces are named `.<j + 1>` after the first, as a helical
 * gear's.
 */
function twistedRing(id: string, tag: string, list: readonly Side[], T: SpiralTrace, Ri: number, Re: number, S: number, N: number, vertices: { id: string; point: Point }[], edges: { id: string; curve: Curve; vertices: [string, string] }[], faces: BrepFaceInput[]): { toe: string[]; heel: string[] } {
  const n = list.length, levels: string[][] = [], Rj = (j: number) => Ri + (Re - Ri) * j / S;
  const V = (i: number, j: number) => `${id}_${tag}${i}${j === 0 ? 't' : j === S ? 'h' : `l${j}`}`;
  for (let j = 0; j <= S; j++) {
    const R = Rj(j), ph = spiralPhi(T, R), c = Math.cos(ph), sn = Math.sin(ph), level: string[] = [];
    list.forEach((p, i) => vertices.push({ id: V(i, j), point: turnedAt(p.curve.controlPoints[0], c, sn, R) }));
    list.forEach((p, i) => {
      const eid = j === 0 ? `${id}_${tag}${i}et` : j === S ? `${id}_${tag}${i}eh` : `${id}_${tag}${i}el${j}`;
      edges.push({ id: eid, curve: { ...p.curve, id: `${eid}c`, controlPoints: p.curve.controlPoints.map(q => turnedAt(q, c, sn, R)) }, vertices: [V(i, j), V((i + 1) % n, j)] });
      level.push(eid);
    });
    levels.push(level);
  }
  for (let j = 0; j < S; j++) {
    const G = twistPoles(T, Rj(j), Rj(j + 1), N), H = G.map((_, k) => Rj(j) + (Rj(j + 1) - Rj(j)) * k / (G.length - 1)), knotsV = bezierKnots(N);
    const ev = (i: number) => S === 1 ? `${id}_${tag}${i}ev` : `${id}_${tag}${i}ev${j}`;
    list.forEach((p, i) => { const p0 = p.curve.controlPoints[0]; edges.push({ id: ev(i), curve: { kind: 'curve', id: `${ev(i)}c`, degree: 3, knots: knotsV, controlPoints: G.map((g, k) => swept(p0, g, H[k])), weights: G.map(() => 1) }, vertices: [V(i, j), V(i, j + 1)] }); });
    list.forEach((p, i) => {
      faces.push({ id: S === 1 ? `${id}_${tag}f${i}` : `${id}_${tag}f${i}_${j}`, name: j === 0 ? p.name : `${p.name}.${j + 1}`, sense: 'forward',
        surface: { kind: 'surface', id: S === 1 ? `${id}_${tag}s${i}` : `${id}_${tag}s${i}_${j}`, degreeU: p.curve.degree, degreeV: 3, knotsU: [...p.curve.knots], knotsV,
          controlPoints: p.curve.controlPoints.map(q => G.map((g, k) => swept(q, g, H[k]))), weights: p.curve.weights.map(w => G.map(() => w)) },
        loops: [{ kind: 'outer', uses: [{ edge: levels[j][i], sense: 'forward' }, { edge: ev((i + 1) % n), sense: 'forward' }, { edge: levels[j + 1][i], sense: 'reversed' }, { edge: ev(i), sense: 'reversed' }] }] });
    });
  }
  return { toe: levels[0], heel: levels[S] };
}
const turnedAt = (p: Point, c: number, s: number, R: number): Point => [R * (c * p[0] - s * p[1]), R * (s * p[0] + c * p[1]), R * p[2]];
const swept = (p: Point, g: readonly number[], H: number): Point => [g[0] * p[0] - g[1] * p[1], g[1] * p[0] + g[0] * p[1], H * p[2]];

/**
 * A straight bevel gear (R12b.3, D134) as a solid in its own frame (apex at the origin, axis +Z, tooth 1 on +X). Faces
 * `<id>.flankL#k`, `.flankR#k` (a flank of more than three pieces on more faces, root outward: `.flankL2#k` …), `.tip#k`,
 * `.root#k` (the space after tooth k), `.rootL#k`/`.rootR#k` (the schematic meridian joins, when the root is under the
 * base cone), `.heel` and `.toe` (spheres about the apex), `.bore#1`/`#2`.
 */
export function bevelGear(spec: BevelGearSpec, options: { readonly id?: string } = {}): { brep: Brep; report: BevelGearReport } {
  const id = safeId(options.id ?? 'bevel'), g = bevelGearDimensions(spec), tol = spec.profileToleranceMM ?? 1e-4 * g.m;
  if (!(Number.isFinite(tol) && tol > 0)) throw new GearError('INVALID_INPUT', 'profileToleranceMM must be a number of mm above 0');
  // (A spiral gear's tolerance is shared: three quarters the section's fit, a quarter the twist's — their sum within it.)
  const T = g.trace, secTol = T ? 0.75 * tol : tol, twistTol = tol - secTol;
  const t0 = g.startPolar > g.deltaB ? rollAt(g.cb, g.sb, g.startPolar) : 0, t1 = rollAt(g.cb, g.sb, g.tipPolar);
  let N = 1, P = conicPieces(g.cb, g.sb, t0, t1, 1), dev = conicDeviation(g.cb, g.sb, P, g.Re);
  while (dev > secTol && N < MAX_PIECES) { P = conicPieces(g.cb, g.sb, t0, t1, ++N); dev = conicDeviation(g.cb, g.sb, P, g.Re); }
  if (dev > secTol) throw new GearError('PROFILE_BUDGET_EXCEEDED', `a flank within ${secTol} mm of the spherical involute needs more than ${MAX_PIECES} conic pieces (${MAX_PIECES} come to ${dev.toExponential(2)} mm)`);
  // The twist (spiral): as few cubic pieces along the cone as keep G within its share, at most five to an axial segment.
  let K = 0, Sg = 1, Nt = 1, twistDev = 0;
  if (T) {
    K = 1; while (twistDeviation(T, g.Ri, g.Re, K) > twistTol && K < MAX_TWIST_PER_SEGMENT * MAX_SEGMENTS) K++;
    Sg = Math.ceil(K / MAX_TWIST_PER_SEGMENT); Nt = Math.ceil(K / Sg);
    for (let j = 0; j < Sg; j++) twistDev = Math.max(twistDev, twistDeviation(T, g.Ri + (g.Re - g.Ri) * j / Sg, g.Ri + (g.Re - g.Ri) * (j + 1) / Sg, Nt));
    if (twistDev > twistTol) throw new GearError('PROFILE_BUDGET_EXCEEDED', `the spiral's twist within ${twistTol.toExponential(2)} mm needs more than ${MAX_SEGMENTS} axial segments of ${MAX_TWIST_PER_SEGMENT} cubic pieces`);
  }
  // (Degree 4 a piece on the sphere: at most three pieces, 13 poles, to a face.)
  const F = Math.ceil(N / PIECES_PER_FACE), meridian = g.rootPolar < g.deltaB, list: Side[] = [];
  for (let k = 0; k < g.z; k++) {
    const gam = g.step * k, n = k + 1;
    if (meridian) list.push({ name: `${id}.rootL#${n}`, curve: meridianArc(gam - g.psiB, g.rootPolar, g.deltaB) });
    for (let f = 0; f < F; f++) { const j0 = Math.round(N * f / F), j1 = Math.round(N * (f + 1) / F); list.push({ name: `${id}.flankL${f ? f + 1 : ''}#${n}`, curve: liftedCurve(P, j0, j1, gam - g.psiB, false) }); }
    list.push({ name: `${id}.tip#${n}`, curve: latitudeArc(g.tipPolar, gam - g.tipHalf, 2 * g.tipHalf) });
    for (let f = F - 1; f >= 0; f--) { const j0 = Math.round(N * f / F), j1 = Math.round(N * (f + 1) / F); list.push({ name: `${id}.flankR${f ? f + 1 : ''}#${n}`, curve: reversed(liftedCurve(P, j0, j1, gam + g.psiB, true)) }); }
    if (meridian) list.push({ name: `${id}.rootR#${n}`, curve: meridianArc(gam + g.psiB, g.deltaB, g.rootPolar) });
    list.push({ name: `${id}.root#${n}`, curve: latitudeArc(g.rootPolar, gam + g.rootHalf, g.step - 2 * g.rootHalf) });
  }
  const vertices: { id: string; point: Point }[] = [], edges: { id: string; curve: Curve; vertices: [string, string] }[] = [], faces: BrepFaceInput[] = [];
  const outer = T ? twistedRing(id, 'o', list, T, g.Ri, g.Re, Sg, Nt, vertices, edges, faces) : sideRing(id, 'o', list, { scale: g.Ri, z: null }, { scale: g.Re, z: null }, vertices, edges, faces);
  const zt = Math.sqrt(g.Ri * g.Ri - g.bore * g.bore), zh = Math.sqrt(g.Re * g.Re - g.bore * g.bore);
  const hole = g.bore > 0 ? sideRing(id, 'h', [{ name: `${id}.bore#1`, curve: arcCurve('b', g.bore, 0, -Math.PI) }, { name: `${id}.bore#2`, curve: arcCurve('b', g.bore, -Math.PI, -Math.PI) }], { scale: 1, z: zt }, { scale: 1, z: zh }, vertices, edges, faces) : null;
  // The ends: the spheres Re and Ri, the square's half-width past the tip circle's image tan(θ/2).
  const a = 1.05 * Math.tan(g.tipPolar / 2) + 0.01;
  const loops = (uses: string[], up: boolean) => up ? uses.map(edge => ({ edge, sense: 'forward' as const })) : [...uses].reverse().map(edge => ({ edge, sense: 'reversed' as const }));
  faces.push({ id: `${id}_heel`, name: `${id}.heel`, surface: stereoSphere(`${id}_sh`, g.Re, a, false), sense: 'forward', loops: [{ kind: 'outer', uses: loops(outer.heel, true) }, ...(hole ? [{ kind: 'inner' as const, uses: loops(hole.heel, true) }] : [])] });
  faces.push({ id: `${id}_toe`, name: `${id}.toe`, surface: stereoSphere(`${id}_st`, g.Ri, a, true), sense: 'forward', loops: [{ kind: 'outer', uses: loops(outer.toe, false) }, ...(hole ? [{ kind: 'inner' as const, uses: loops(hole.toe, false) }] : [])] });
  const brep = buildBrep({ source: { family: 'gear', id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_shell`, faces, closed: true }] }] });
  const deg = (x: number) => x * 180 / Math.PI, diagnostics: GearDiagnostic[] = [];
  diagnostics.push({ code: 'ROOT_TRANSITION_UNVALIDATED', severity: 'warning', message: meridian ? 'the flanks meet the root cone by meridian faces from the base cone: a schematic root, not the one the generating tool cuts' : 'the flanks meet the root cone at a corner: a schematic root, not the one the generating tool cuts' });
  if (T) diagnostics.push({ code: 'IDEAL_MODEL', severity: 'warning', message: 'an ideal spiral bevel gear (line contact): the conjugate of its mate on every sphere about the apex, not a face-milled or face-hobbed tooth — no crowning, no machine settings' });
  if (g.b > g.Re / 3) diagnostics.push({ code: 'INVALID_INPUT', severity: 'warning', message: `the face width ${g.b} mm is over a third of the cone distance (${(g.Re / 3).toFixed(4)} mm), the usual limit of proportion: the toe's teeth are small` });
  const spiral = T ? (() => {
    const bT = Math.asin(spiralSin(T, g.Ri)), bH = Math.asin(spiralSin(T, g.Re));
    return { meanSpiralAngleDeg: deg(T.betaM), hand: T.h > 0 ? 'right' as const : 'left' as const, cutterRadiusMM: T.rc, trace: 'circular' as const, meanConeDistanceMM: T.Rm, spiralAngleAtToeDeg: deg(bT), spiralAngleAtHeelDeg: deg(bH),
      transversePressureAngleDeg: deg(g.alpha), normalPressureAngleAtToeDeg: deg(Math.atan(Math.tan(g.alpha) * Math.cos(bT))), normalPressureAngleAtHeelDeg: deg(Math.atan(Math.tan(g.alpha) * Math.cos(bH))),
      twistDeg: deg(spiralPhi(T, g.Re) - spiralPhi(T, g.Ri)), twistPieces: Sg * Nt, axialSegments: Sg, twistDeviationMM: twistDev };
  })() : undefined;
  return { brep, report: { generator: 'bevel-gear@0', kind: T ? 'spiral' : 'straight', system: 'standard', profile: 'spherical-involute', ends: 'spherical',
    dimensions: { referenceDiameterMM: g.m * g.z, shaftAngleDeg: deg(g.Sigma), pitchAngleDeg: deg(g.delta), baseConeAngleDeg: deg(g.deltaB), addendumAngleDeg: deg(g.thA), dedendumAngleDeg: deg(g.thF), tipAngleDeg: deg(g.tipPolar), rootAngleDeg: deg(g.rootPolar),
      coneDistanceMM: g.Re, innerConeDistanceMM: g.Ri, faceWidthMM: g.b, tipDiameterAtHeelMM: 2 * g.Re * Math.sin(g.tipPolar), rootDiameterAtHeelMM: 2 * g.Re * Math.sin(g.rootPolar), circularPitchMM: Math.PI * g.m, toothThicknessMM: g.s,
      axialExtentMM: [g.Ri * Math.cos(g.tipPolar), g.bore > 0 ? zh : g.Re] },
    virtualTeeth: g.zv, flankPieces: N, flankFaces: F, profileDeviationMM: dev, profileToleranceMM: tol, rootPolicy: 'schematic-meridian', manufacturingValidated: false, idealModel: !!T, ...(spiral ? { spiral } : {}), diagnostics } };
}

// ——— The pair ———

export interface BevelGearPairOptions { readonly relativePhaseDeg?: number; readonly samples?: number; readonly mode?: 'report' | 'verdict' }
export interface BevelGearPairCheck {
  readonly shaftAngleDeg: number; readonly pitchAnglesDeg: readonly [number, number]; readonly coneDistanceMM: number;
  /** z2 / z1: gear 2 turns this many times slower. */
  readonly speedRatio: number;
  /** Circumferential at the heel's pitch circle: the two thickness reductions. */
  readonly backlashMM: number;
  /** At the heel, along the sphere: Re (θf2 − θa1) and Re (θf1 − θa2). */
  readonly tipClearancesMM: readonly [number, number];
  /**
   * The exact spherical contact ratio (the arc of the great circle of action between the tip cones over the base pitch
   * 2π sin δb / z), the usable one (from where each flank starts), and Tredgold's virtual spur pair's (an estimate).
   */
  readonly idealContactRatio: number; readonly usableContactRatio: number; readonly tredgoldContactRatio: number;
  /**
   * One tooth period of gear 1 swept on the heel sphere, at `samples` and twice as many, the least clearance refined (mm
   * at the heel). The outlines are chords of the involutes, inside each convex tooth: the least can come out larger than
   * the true one by up to `chordSagMM`, the two outlines' largest chord sag at the heel — never smaller.
   */
  readonly sweep: { readonly samples: number; readonly minimumClearanceMM: number; readonly atDegrees: number; readonly interference: boolean; readonly converged: boolean; readonly coarseMinimumMM: number; readonly chordSagMM: number };
  /**
   * A spiral pair (R12b.4): the same sweep on five spheres from the toe to the heel, each section turned by its gear's
   * φ(R) (an ideal pair: the same on every sphere, its clearance scaled by R; the heel's refined, the others the least of
   * `samples`); the face contact ratio |ψ(Re) − ψ(Ri)|
   * over the crown pitch 2π sin δ1 / z1, and the total with the transverse one.
   */
  readonly spheres?: readonly { readonly coneDistanceMM: number; readonly minimumClearanceMM: number; readonly interference: boolean }[];
  readonly faceContactRatio?: number; readonly totalContactRatio?: number;
  /** Which way each gear is pushed along its axis, gear 1 driving either way (a direction, no load). */
  readonly axialThrust: string;
  readonly diagnostics: readonly GearDiagnostic[];
}

function compatible(g1: BevelGearSpec, g2: BevelGearSpec, a: BevelGearDimensions, b: BevelGearDimensions): void {
  if (a.m !== b.m) throw new GearError('MATE_INCOMPATIBLE', `the modules differ (${a.m} and ${b.m} mm)`);
  if (a.Sigma !== b.Sigma) throw new GearError('MATE_INCOMPATIBLE', `the shaft angles differ (${(a.Sigma * 180 / Math.PI)}° and ${(b.Sigma * 180 / Math.PI)}°)`);
  if (g1.mateTeeth !== g2.teeth || g2.mateTeeth !== g1.teeth) throw new GearError('MATE_INCOMPATIBLE', `each gear's mateTeeth must be the other's teeth (${g1.teeth} with mate ${g1.mateTeeth}, ${g2.teeth} with mate ${g2.mateTeeth}): their pitch cones are another pair's`);
  // (A spiral pair shares its tooth trace: one spiral angle, cutter radius and face width, the hands opposite.)
  const s1 = g1.spiral, s2 = g2.spiral;
  if (!!s1 !== !!s2) throw new GearError('MATE_INCOMPATIBLE', 'a spiral bevel gear meshes with a spiral one, a straight with a straight');
  if (s1 && s2) {
    if (s1.hand === s2.hand) throw new GearError('MATE_INCOMPATIBLE', `both are ${s1.hand}-handed: a spiral bevel pair is of opposite hands`);
    if (s1.angleDeg !== s2.angleDeg || s1.cutterRadiusMM !== s2.cutterRadiusMM) throw new GearError('MATE_INCOMPATIBLE', `the spirals differ (${s1.angleDeg}° on r_c ${s1.cutterRadiusMM} mm and ${s2.angleDeg}° on ${s2.cutterRadiusMM} mm): a pair shares its tooth trace`);
    if (a.b !== b.b) throw new GearError('MATE_INCOMPATIBLE', `the face widths differ (${a.b} and ${b.b} mm): a spiral pair shares its tooth trace, through the mean point`);
  }
}

/**
 * The pair checks (R12b.3, D134): the same module and shaft angle, each the other's mate (else MATE_INCOMPATIBLE);
 * the ratio, the heel's backlash and tip clearances; the contact ratios; and the two exact outlines (the spherical
 * involute, densely) swept through one tooth period of gear 1 on the heel sphere — a straight bevel pair is the same on
 * every sphere about the apex — gear 2 turning −θ z1/z2, the least clearance found and refined, interference where they
 * cross. Gear 1's axis +Z, gear 2's at Σ from it in the XZ plane, the pitch line at gear 1's azimuth 0; gear 2 turned so
 * a space faces gear 1's tooth there, plus the phase.
 */
export function checkBevelGearPair(g1: BevelGearSpec, g2: BevelGearSpec, options: BevelGearPairOptions = {}): BevelGearPairCheck {
  const key = JSON.stringify([g1, g2, options.relativePhaseDeg ?? 0, options.samples ?? 64, options.mode ?? 'report']);
  let kept = pairCache.get(key);
  if (kept) { pairCache.delete(key); pairCache.set(key, kept); return kept; }
  kept = pairCheck(g1, g2, options); pairCache.set(key, kept); if (pairCache.size > 64) pairCache.delete(pairCache.keys().next().value!);
  return kept;
}
const pairCache = new Map<string, BevelGearPairCheck>();

/** The flank's chords' largest sag on the unit sphere (each chord against the involute at its middle roll), F chords. */
function flankSag(g: BevelGearDimensions, t0: number, t1: number, F: number): number {
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
  let worst = 0;
  for (let i = 0; i < F; i++) {
    involutePoint(g.cb, g.sb, t0 + (t1 - t0) * i / F, a); involutePoint(g.cb, g.sb, t0 + (t1 - t0) * (i + 1) / F, b); involutePoint(g.cb, g.sb, t0 + (t1 - t0) * (i + 0.5) / F, c);
    const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2], l2 = ex * ex + ey * ey + ez * ez, t = l2 > 0 ? ((c[0] - a[0]) * ex + (c[1] - a[1]) * ey + (c[2] - a[2]) * ez) / l2 : 0;
    worst = Math.max(worst, Math.hypot(c[0] - a[0] - t * ex, c[1] - a[1] - t * ey, c[2] - a[2] - t * ez));
  }
  // (The middle roll is not the farthest point exactly: a quarter more covers it.)
  return 1.25 * worst;
}
/** A gear's exact outline on the unit sphere, one tooth centred on azimuth 0 from space middle to space middle (xyz). */
function exactOutline(g: BevelGearDimensions): Float64Array {
  const F = 150, A = 24, pts: number[] = [], o = [0, 0, 0], t0 = g.startPolar > g.deltaB ? rollAt(g.cb, g.sb, g.startPolar) : 0, t1 = rollAt(g.cb, g.sb, g.tipPolar);
  const lat = (th: number, az: number) => { pts.push(Math.sin(th) * Math.cos(az), Math.sin(th) * Math.sin(az), Math.cos(th)); };
  for (let i = 0; i <= A / 2; i++) lat(g.rootPolar, -g.step / 2 + (g.step / 2 - g.rootHalf) * i / (A / 2));
  if (g.rootPolar < g.deltaB) lat(g.deltaB, -g.psiB);
  for (let i = 0; i <= F; i++) { involutePoint(g.cb, g.sb, t0 + (t1 - t0) * i / F, o); const c = Math.cos(-g.psiB), s = Math.sin(-g.psiB); pts.push(c * o[0] - s * o[1], s * o[0] + c * o[1], o[2]); }
  for (let i = 1; i < A; i++) lat(g.tipPolar, -g.tipHalf + 2 * g.tipHalf * i / A);
  for (let i = F; i >= 0; i--) { involutePoint(g.cb, g.sb, t0 + (t1 - t0) * i / F, o); const c = Math.cos(g.psiB), s = Math.sin(g.psiB); pts.push(c * o[0] + s * o[1], s * o[0] - c * o[1], o[2]); }
  if (g.rootPolar < g.deltaB) lat(g.rootPolar, g.psiB);
  for (let i = 0; i <= A / 2; i++) lat(g.rootPolar, g.rootHalf + (g.step / 2 - g.rootHalf) * i / (A / 2));
  return Float64Array.from(pts);
}

/** The sweep's fixed frame: the pitch point P, the gnomonic plane's axes there (e1 × e2 = P: seen from outside), gear 2's frame. */
interface SweepFrame { readonly P: Point; readonly e1: Point; readonly e2: Point; readonly X2: Point; readonly Y2: Point; readonly Z2: Point; readonly cosReach1: number; readonly cosReach2: number }
interface Segments { readonly flat: Float64Array; readonly space: Float64Array; readonly k: Float64Array }

/**
 * The tooth runs of an outline (one tooth, `z` teeth) turned by θ about its axis, those within three pitches of its
 * azimuth 0, mapped by the frame (gear 2's) or not (gear 1's), as segments whose ends lie within the other gear's tip
 * cone and a module: in the gnomonic plane at P (x0, y0, x1, y1), on the sphere (xyz, xyz), and the least cosine of
 * their ends' angle from P (the plane stretches lengths there by at most 1/k²).
 */
function segmentsOf(T: Float64Array, z: number, theta: number, S: SweepFrame, second: boolean): Segments {
  const flat: number[] = [], space: number[] = [], ks: number[] = [], step = 2 * Math.PI / z, ax = second ? [0, 0, 1] : S.Z2, cosReach = second ? S.cosReach1 : S.cosReach2;
  for (let k = 0; k < z; k++) {
    const ang = theta + step * k; let d = ang; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    if (Math.abs(d) > 3 * step) continue;
    const c = Math.cos(ang), s = Math.sin(ang);
    let px = 0, py = 0, pz = 0, qx = 0, qy = 0, pk = 0, ok = false;
    for (let i = 0; i < T.length; i += 3) {
      const lx = c * T[i] - s * T[i + 1], ly = s * T[i] + c * T[i + 1], lz = T[i + 2];
      const wx = second ? S.X2[0] * lx + S.Y2[0] * ly + S.Z2[0] * lz : lx, wy = second ? S.X2[1] * lx + S.Y2[1] * ly + S.Z2[1] * lz : ly, wz = second ? S.X2[2] * lx + S.Y2[2] * ly + S.Z2[2] * lz : lz;
      const near = wx * ax[0] + wy * ax[1] + wz * ax[2] >= cosReach, kk = wx * S.P[0] + wy * S.P[1] + wz * S.P[2];
      const fx = (wx * S.e1[0] + wy * S.e1[1] + wz * S.e1[2]) / kk, fy = (wx * S.e2[0] + wy * S.e2[1] + wz * S.e2[2]) / kk;
      if (i > 0 && (near || ok) && kk > 0.5 && pk > 0.5) { flat.push(qx, qy, fx, fy); space.push(px, py, pz, wx, wy, wz); ks.push(Math.min(pk, kk)); }
      px = wx; py = wy; pz = wz; qx = fx; qy = fy; pk = kk; ok = near && kk > 0.5;
    }
  }
  return { flat: Float64Array.from(flat), space: Float64Array.from(space), k: Float64Array.from(ks) };
}
/** The distance between two segments on the unit sphere (chords: the arc to rounding at these lengths). */
function spaceDistance(A: Float64Array, i: number, B: Float64Array, j: number): number {
  return Math.min(pointSegment3(A, i, B, j), pointSegment3(A, i + 3, B, j), pointSegment3(B, j, A, i), pointSegment3(B, j + 3, A, i));
}
function pointSegment3(P: Float64Array, p: number, S: Float64Array, s: number): number {
  const ex = S[s + 3] - S[s], ey = S[s + 4] - S[s + 1], ez = S[s + 5] - S[s + 2], l2 = ex * ex + ey * ey + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((P[p] - S[s]) * ex + (P[p + 1] - S[s + 1]) * ey + (P[p + 2] - S[s + 2]) * ez) / l2)) : 0;
  return Math.hypot(P[p] - S[s] - t * ex, P[p + 1] - S[s + 1] - t * ey, P[p + 2] - S[s + 2] - t * ez);
}
/**
 * The least distance between the two outlines near the mesh (on the unit sphere), negative when they cross (by the
 * deepest point of one inside the other, in the gnomonic plane: each run goes counter-clockwise round its gear seen
 * from outside, its material on the left).
 */
function sphereClearance(T1: Float64Array, z1: number, th1: number, T2: Float64Array, z2: number, th2: number, S: SweepFrame, verdict: boolean): number {
  const A = segmentsOf(T1, z1, th1, S, false), B = segmentsOf(T2, z2, th2, S, true), a = A.flat, b = B.flat;
  // (The plane prunes and finds crossings; the least is measured on the sphere. The gnomonic map stretches a length
  // near points at angle w from P by at most 1/cos² w: a pair e apart in the plane is at least e k² apart on the sphere,
  // k the least cosine of the two segments' ends — pairs farther than that from the best so far are passed over.)
  let near = Infinity;
  for (let i = 0; i < a.length; i += 4) {
    const ax = a[i], ay = a[i + 1], bx = a[i + 2], by = a[i + 3], x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by), ka = A.k[i / 4];
    for (let j = 0; j < b.length; j += 4) {
      const cx = b[j], cy = b[j + 1], dx = b[j + 2], dy = b[j + 3], k = Math.min(ka, B.k[j / 4]), k2 = k * k;
      const gx = Math.max(0, Math.min(cx, dx) - x1, x0 - Math.max(cx, dx)), gy = Math.max(0, Math.min(cy, dy) - y1, y0 - Math.max(cy, dy));
      if ((gx * gx + gy * gy) * k2 * k2 > near * near) continue;
      if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) return verdict ? -1 : -depthOf(a, b);
      const e = Math.min(pointSegment(ax, ay, cx, cy, dx, dy), pointSegment(bx, by, cx, cy, dx, dy), pointSegment(cx, cy, ax, ay, bx, by), pointSegment(dx, dy, ax, ay, bx, by));
      if (e * k2 > near) continue;
      const d = spaceDistance(A.space, i / 4 * 6, B.space, j / 4 * 6); if (d < near) near = d;
    }
  }
  return near;
}
/** How deep the crossing goes: the farthest point of either side's segments on the left of the other's nearest segment. */
function depthOf(X: Float64Array, Y: Float64Array): number {
  let deep = 0;
  for (const [P, Q] of [[X, Y], [Y, X]] as const) for (let i = 0; i < P.length; i += 2) {
    const px = P[i], py = P[i + 1];
    let d = Infinity, side = 0;
    for (let j = 0; j < Q.length; j += 4) {
      const gx = Math.max(0, Math.min(Q[j], Q[j + 2]) - px, px - Math.max(Q[j], Q[j + 2])), gy = Math.max(0, Math.min(Q[j + 1], Q[j + 3]) - py, py - Math.max(Q[j + 1], Q[j + 3]));
      if (gx * gx + gy * gy > d * d) continue;
      const e = pointSegment(px, py, Q[j], Q[j + 1], Q[j + 2], Q[j + 3]); if (e < d) { d = e; side = orient(Q[j], Q[j + 1], Q[j + 2], Q[j + 3], px, py); }
    }
    if (side > 0 && d > deep) deep = d;
  }
  return deep;
}

function sweepFrame(a1: BevelGearDimensions, a2: BevelGearDimensions): SweepFrame {
  const d1 = a1.delta, Sg = a1.Sigma, P: Point = [Math.sin(d1), 0, Math.cos(d1)], Z2: Point = [Math.sin(Sg), 0, Math.cos(Sg)];
  const c2 = Math.cos(a2.delta), s2 = Math.sin(a2.delta), X2: Point = [(P[0] - c2 * Z2[0]) / s2, 0, (P[2] - c2 * Z2[2]) / s2];
  const Y2: Point = [Z2[1] * X2[2] - Z2[2] * X2[1], Z2[2] * X2[0] - Z2[0] * X2[2], Z2[0] * X2[1] - Z2[1] * X2[0]];
  // (e1 along gear 1's turn at P, e2 = P × e1: e1 × e2 = P.)
  const e1: Point = [0, 1, 0], e2: Point = [P[1] * e1[2] - P[2] * e1[1], P[2] * e1[0] - P[0] * e1[2], P[0] * e1[1] - P[1] * e1[0]];
  const mrg = a1.m / a1.Re;
  return { P, e1, e2, X2, Y2, Z2, cosReach1: Math.cos(a1.tipPolar + mrg), cosReach2: Math.cos(a2.tipPolar + mrg) };
}

function pairCheck(g1: BevelGearSpec, g2: BevelGearSpec, options: BevelGearPairOptions): BevelGearPairCheck {
  const a1 = bevelGearDimensions(g1), a2 = bevelGearDimensions(g2);
  compatible(g1, g2, a1, a2);
  const z1 = a1.z, z2 = a2.z, Re = a1.Re, m = a1.m, pb = 2 * Math.PI * a1.sb / z1;
  // The great circle of action, by the arc u from T1 (gear 1's base-cone tangent point): T1 → P is acos(cos δ1 / cos δb1),
  // P → T2 likewise; a point at polar θ on gear i's generating circle lies acos(cos θ / cos δbi) from Ti.
  const arc = (g: BevelGearDimensions, th: number) => Math.acos(Math.min(1, Math.cos(th) / g.cb));
  const L = a1.toBase + a2.toBase, hi1 = arc(a1, a1.tipPolar), hi2 = arc(a2, a2.tipPolar), lo1 = a1.startPolar > a1.deltaB ? arc(a1, a1.startPolar) : 0, lo2 = a2.startPolar > a2.deltaB ? arc(a2, a2.startPolar) : 0;
  const ideal = (hi1 + hi2 - L) / pb, usable = Math.max(0, Math.min(hi1, L - lo2) - Math.max(lo1, L - hi2)) / pb;
  // Tredgold's: the virtual spur gears on the back cones, radii Re tan δ.
  const rv1 = Re * Math.tan(a1.delta), rv2 = Re * Math.tan(a2.delta), ca = Math.cos(a1.alpha);
  const tredgold = (Math.sqrt((rv1 + m) ** 2 - (rv1 * ca) ** 2) + Math.sqrt((rv2 + m) ** 2 - (rv2 * ca) ** 2) - (rv1 + rv2) * Math.sin(a1.alpha)) / (Math.PI * m * ca);
  const tips: [number, number] = [Re * (a2.thF - a1.thA), Re * (a1.thF - a2.thA)];
  const sag = Re * (flankSag(a1, a1.startPolar > a1.deltaB ? rollAt(a1.cb, a1.sb, a1.startPolar) : 0, rollAt(a1.cb, a1.sb, a1.tipPolar), 150) + flankSag(a2, a2.startPolar > a2.deltaB ? rollAt(a2.cb, a2.sb, a2.startPolar) : 0, rollAt(a2.cb, a2.sb, a2.tipPolar), 150));
  const T1 = exactOutline(a1), T2 = exactOutline(a2), S = sweepFrame(a1, a2), phase = (options.relativePhaseDeg ?? 0) * Math.PI / 180;
  const verdict = options.mode === 'verdict', N = Math.max(16, options.samples ?? 64), W: SweepWork = { T1, T2, z1, z2, S, verdict, N, m };
  const tr = a1.trace, tr2 = a2.trace;
  // (Spiral: Δψ over the face, in crown pitches.)
  const faceRatio = tr ? Math.abs(spiralPsi(tr, a1.Re) - spiralPsi(tr, a1.Ri)) * z1 / (2 * Math.PI * Math.sin(a1.delta)) : 0;
  const head = { shaftAngleDeg: a1.Sigma * 180 / Math.PI, pitchAnglesDeg: [a1.delta * 180 / Math.PI, a2.delta * 180 / Math.PI] as const, coneDistanceMM: Re, speedRatio: z2 / z1, backlashMM: a1.red + a2.red, tipClearancesMM: tips, idealContactRatio: ideal, usableContactRatio: usable, tredgoldContactRatio: tredgold,
    ...(tr ? { faceContactRatio: faceRatio, totalContactRatio: usable + faceRatio } : {}), axialThrust: thrustWords(a1, a2) };
  // The heel's sweep; a spiral pair's on five spheres, each section turned by its own φ(R) (the heel's the last).
  const heel = sweepOn(W, Re, tr ? spiralPhi(tr, Re) : 0, phase + (tr2 ? spiralPhi(tr2, Re) : 0));
  const spheres = tr && tr2 ? [0, 1, 2, 3].map(k => { const R = a1.Ri + (Re - a1.Ri) * k / 4, r = sweepOn(W, R, spiralPhi(tr, R), phase + spiralPhi(tr2, R), false); return { coneDistanceMM: R, minimumClearanceMM: r.least, interference: r.least < 0 }; }).concat([{ coneDistanceMM: Re, minimumClearanceMM: heel.least, interference: heel.least < 0 }]) : undefined;
  const diagnostics: GearDiagnostic[] = [], crossedOn = spheres ? spheres.filter(x => x.interference) : heel.least < 0 ? [{ coneDistanceMM: Re }] : [];
  if (crossedOn.length) diagnostics.push({ code: 'SELF_INTERSECTION', severity: 'error', message: verdict ? `the teeth cross at ${(heel.at * 180 / Math.PI).toFixed(4)}° of gear 1 (the depth: a report)` : `the teeth cross${heel.least < 0 ? ` by ${(-heel.least).toFixed(6)} mm at the heel, at ${(heel.at * 180 / Math.PI).toFixed(4)}° of gear 1` : ''}${spheres ? ` (on the spheres at ${crossedOn.map(x => x.coneDistanceMM.toFixed(3)).join(', ')} mm)` : ''}` });
  if (!verdict && !heel.converged) diagnostics.push({ code: 'INVALID_INPUT', severity: 'warning', message: `the sweep did not settle (${N} samples: ${heel.coarse.toExponential(3)}, ${2 * N}: ${heel.fine.toExponential(3)} mm): more samples are needed` });
  if (!verdict && usable + 1e-12 < ideal) diagnostics.push({ code: 'ROOT_TRANSITION_UNVALIDATED', severity: 'warning', message: `the usable flanks give a contact ratio of ${usable.toFixed(4)}, below the ideal ${ideal.toFixed(4)}` });
  return { ...head, sweep: { samples: N, minimumClearanceMM: verdict && heel.least < 0 ? -0 : heel.least, atDegrees: heel.at * 180 / Math.PI, interference: crossedOn.length > 0, converged: !verdict && heel.converged, coarseMinimumMM: heel.coarse, chordSagMM: sag }, ...(spheres ? { spheres } : {}), diagnostics };
}
interface SweepWork { readonly T1: Float64Array; readonly T2: Float64Array; readonly z1: number; readonly z2: number; readonly S: SweepFrame; readonly verdict: boolean; readonly N: number; readonly m: number }
/** The clearance on the sphere R (mm there), gear 1 turned θ + off1, gear 2 π/z2 − θ z1/z2 + off2. */
const clearanceOn = (W: SweepWork, R: number, off1: number, off2: number, th: number) => R * sphereClearance(W.T1, W.z1, th + off1, W.T2, W.z2, Math.PI / W.z2 - th * W.z1 / W.z2 + off2, W.S, W.verdict);
/**
 * One tooth period of gear 1 on the sphere R: verdict, one scan stopping at the first crossing; report, `N` samples
 * and twice as many, golden section about the least (as D55).
 */
function sweepOn(W: SweepWork, R: number, off1: number, off2: number, refine = true): { least: number; at: number; coarse: number; fine: number; converged: boolean } {
  const period = 2 * Math.PI / W.z1, N = W.N;
  // (`refine` false — a spiral pair's spheres before the heel: one scan of N samples, not refined; the heel's is.)
  if (W.verdict || !refine) {
    let least = Infinity, at = 0;
    for (let i = 0; i < N; i++) { const t = period * i / N, d = clearanceOn(W, R, off1, off2, t); if (d < least) { least = d; at = t; } if (d < 0 && W.verdict) break; }
    return { least, at, coarse: least, fine: least, converged: false };
  }
  let cd = Infinity, ct = 0, fd = Infinity, ft = 0;
  for (let i = 0; i < N; i++) { const t = period * i / N, d = clearanceOn(W, R, off1, off2, t); if (d < cd) { cd = d; ct = t; } }
  for (let i = 0; i < 2 * N; i++) { const t = period * i / (2 * N), d = clearanceOn(W, R, off1, off2, t); if (d < fd) { fd = d; ft = t; } }
  const seedD = fd < cd ? fd : cd, seedT = fd < cd ? ft : ct;
  let lo = seedT - period / N, hi = seedT + period / N, x1 = hi - 0.618033988749895 * (hi - lo), x2 = lo + 0.618033988749895 * (hi - lo), f1 = clearanceOn(W, R, off1, off2, x1), f2 = clearanceOn(W, R, off1, off2, x2);
  for (let it = 0; it < 60 && hi - lo > 1e-9; it++) { if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - 0.618033988749895 * (hi - lo); f1 = clearanceOn(W, R, off1, off2, x1); } else { lo = x1; x1 = x2; f1 = f2; x2 = lo + 0.618033988749895 * (hi - lo); f2 = clearanceOn(W, R, off1, off2, x2); } }
  const least = Math.min(seedD, f1, f2);
  return { least, at: f1 < f2 ? x1 : x2, coarse: cd, fine: fd, converged: Math.abs(cd - fd) <= Math.max(1e-6 * W.m, 0.02 * Math.abs(least)) };
}

/** A flank's point (gear frame, unit sphere × R) at polar θ and cone distance R: `side` +1 the tooth's higher-azimuth flank (R), −1 the other (L). */
function flankAt(g: BevelGearDimensions, side: number, th: number, R: number): Point {
  const az = side * (g.psiB - involuteAzimuth(g.cb, g.sb, th)) + (g.trace ? spiralPhi(g.trace, R) : 0);
  return [R * Math.sin(th) * Math.cos(az), R * Math.sin(th) * Math.sin(az), R * Math.cos(th)];
}
/**
 * Which way the tooth force pushes each gear along its axis (R12b.4; a straight pair's too): at the mean point on the
 * pitch cone the driver's working flank's outward normal n (the leading flank: R turning clockwise seen from its apex,
 * L the other way); the driver takes −n, the driven +n, read along each axis (toward the teeth from the apex: away from
 * the apex). A direction, no load.
 */
function thrustWords(a1: BevelGearDimensions, a2: BevelGearDimensions): string {
  const Rm = (a1.Re + a1.Ri) / 2, h = 1e-6, out: string[] = [];
  for (const side of [1, -1]) {
    const th = a1.delta, p = flankAt(a1, side, th, Rm), pa = flankAt(a1, side, th + h, Rm), pb = flankAt(a1, side, th - h, Rm), ra = flankAt(a1, side, th, Rm * (1 + h)), rb = flankAt(a1, side, th, Rm * (1 - h));
    let n = cross3([pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]], [ra[0] - rb[0], ra[1] - rb[1], ra[2] - rb[2]]);
    // (Outward: along +e_φ on the R flank, −e_φ on the L.)
    const az = Math.atan2(p[1], p[0]), ephi = [-Math.sin(az), Math.cos(az), 0];
    if (Math.sign(dot3(n, ephi)) !== side) n = [-n[0], -n[1], -n[2]];
    // (Turned so the point sits on the pitch line, gear 2's axis then (sin Σ, 0, cos Σ).)
    const c = Math.cos(-az), s = Math.sin(-az), nr = [c * n[0] - s * n[1], s * n[0] + c * n[1], n[2]];
    const on1 = -n[2], on2 = nr[0] * Math.sin(a1.Sigma) + nr[2] * Math.cos(a1.Sigma);
    out.push(`gear 1 driving ${side > 0 ? 'clockwise' : 'counter-clockwise'} seen from its apex is pushed ${on1 > 0 ? 'away from' : 'toward'} its apex, gear 2 ${on2 > 0 ? 'away from' : 'toward'} its own`);
  }
  void a2;
  return `${out.join('; ')} (directions, no load)`;
}

// ——— Placed ———

/** A bevel gear as it stands: its apex, its axis (toward its teeth: the frame's Z), the frame's X, turned by `rotation` (radians) about the axis from X. */
export interface PlacedBevelGear { readonly spec: BevelGearSpec; readonly apex: Point; readonly axis: Point; readonly xAxis: Point; readonly rotation: number }
export interface PlacedBevelGearPairCheck extends BevelGearPairCheck { readonly relativePhaseDeg: number }

const cross3 = (a: readonly number[], b: readonly number[]): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit3 = (a: readonly number[]): Point => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

/** The placed gear's map from its own frame (apex origin, axis +Z, tooth 1 on +X) into the part: row-major 3 × 3 and the offset. */
export function bevelGearMatrix(p: PlacedBevelGear): { matrix: [number, number, number, number, number, number, number, number, number]; offset: Point } {
  const Z = unit3(p.axis), X = unit3(p.xAxis), Y = cross3(Z, X), c = Math.cos(p.rotation), s = Math.sin(p.rotation);
  return { matrix: [X[0] * c + Y[0] * s, -X[0] * s + Y[0] * c, Z[0], X[1] * c + Y[1] * s, -X[1] * s + Y[1] * c, Z[1], X[2] * c + Y[2] * s, -X[2] * s + Y[2] * c, Z[2]], offset: [...p.apex] as Point };
}

/**
 * Where a gear meshing with `driver` stands (R12b.3): the same apex; its axis at the shaft angle from the driver's, in
 * the plane through the driver's axis and the direction `direction` (radians from the driver's X about its axis); its X
 * toward the pitch line; turned so a space faces the driver's tooth on the pitch line (plus `phase`), following the
 * driver's turn by −z1/z2.
 */
export function bevelMatePlacement(driver: PlacedBevelGear, mate: BevelGearSpec, direction: number, phase: number): PlacedBevelGear {
  const a1 = bevelGearDimensions(driver.spec), a2 = bevelGearDimensions(mate);
  compatible(driver.spec, mate, a1, a2);
  const Z1 = unit3(driver.axis), X1 = unit3(driver.xAxis), Y1 = cross3(Z1, X1), c = Math.cos(direction), s = Math.sin(direction);
  const d: Point = [c * X1[0] + s * Y1[0], c * X1[1] + s * Y1[1], c * X1[2] + s * Y1[2]];
  const Z2: Point = [Math.cos(a1.Sigma) * Z1[0] + Math.sin(a1.Sigma) * d[0], Math.cos(a1.Sigma) * Z1[1] + Math.sin(a1.Sigma) * d[1], Math.cos(a1.Sigma) * Z1[2] + Math.sin(a1.Sigma) * d[2]];
  const P: Point = [Math.cos(a1.delta) * Z1[0] + Math.sin(a1.delta) * d[0], Math.cos(a1.delta) * Z1[1] + Math.sin(a1.delta) * d[1], Math.cos(a1.delta) * Z1[2] + Math.sin(a1.delta) * d[2]];
  const cd = Math.cos(a2.delta), X2 = unit3([P[0] - cd * Z2[0], P[1] - cd * Z2[1], P[2] - cd * Z2[2]]);
  return { spec: mate, apex: [...driver.apex] as Point, axis: Z2, xAxis: X2, rotation: Math.PI / a2.z - (driver.rotation - direction) * a1.z / a2.z + phase };
}

/**
 * The pair checks for two gears as placed: the apexes together and the axes at the shaft angle (else
 * MATE_INCOMPATIBLE), the relative phase from their turns (each against the pitch line, gear 1's carried through the
 * ratio, modulo gear 2's pitch angle), then `checkBevelGearPair`.
 */
export function checkPlacedBevelGears(g1: PlacedBevelGear, g2: PlacedBevelGear, options: Omit<BevelGearPairOptions, 'relativePhaseDeg'> = {}): PlacedBevelGearPairCheck {
  const a1 = bevelGearDimensions(g1.spec), a2 = bevelGearDimensions(g2.spec);
  compatible(g1.spec, g2.spec, a1, a2);
  const apart = Math.hypot(g2.apex[0] - g1.apex[0], g2.apex[1] - g1.apex[1], g2.apex[2] - g1.apex[2]);
  if (apart > 1e-6 * a1.Re) throw new GearError('MATE_INCOMPATIBLE', `the apexes are ${apart.toFixed(6)} mm apart: a bevel pair shares its apex`);
  const Z1 = unit3(g1.axis), Z2 = unit3(g2.axis), angle = Math.acos(Math.max(-1, Math.min(1, dot3(Z1, Z2))));
  if (Math.abs(angle - a1.Sigma) > 1e-9) throw new GearError('MATE_INCOMPATIBLE', `the axes are ${(angle * 180 / Math.PI).toFixed(6)}° apart, not the shaft angle ${(a1.Sigma * 180 / Math.PI)}°`);
  const k = dot3(Z2, Z1), d = unit3([Z2[0] - k * Z1[0], Z2[1] - k * Z1[1], Z2[2] - k * Z1[2]]);
  const P: Point = [Math.cos(a1.delta) * Z1[0] + Math.sin(a1.delta) * d[0], Math.cos(a1.delta) * Z1[1] + Math.sin(a1.delta) * d[1], Math.cos(a1.delta) * Z1[2] + Math.sin(a1.delta) * d[2]];
  const X1 = unit3(g1.xAxis), Y1 = cross3(Z1, X1), X2 = unit3(g2.xAxis), Y2 = cross3(Z2, X2);
  const phi1 = Math.atan2(dot3(d, Y1), dot3(d, X1)), phi2 = Math.atan2(dot3(P, Y2), dot3(P, X2)), z1 = a1.z, z2 = a2.z, pitch = 2 * Math.PI / z2;
  const raw = (g2.rotation - phi2) - Math.PI / z2 + (g1.rotation - phi1) * z1 / z2;
  let phase = ((raw % pitch) + pitch) % pitch; if (phase < 1e-9 * pitch || pitch - phase < 1e-9 * pitch) phase = 0;
  const phaseDeg = phase * 180 / Math.PI;
  return { ...checkBevelGearPair(g1.spec, g2.spec, { ...options, relativePhaseDeg: phaseDeg }), relativePhaseDeg: phaseDeg };
}
