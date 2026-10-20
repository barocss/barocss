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
import type { Brep } from './brep-core.js';
import type { Curve } from './types.js';
import {
  GearError, inv, spurGearDimensions, spurGearProfile, extrudedProfile, helixTwist, arcCurve, reversed, safeId, exactProfile, segmentsCross, pointSegment, orient,
  type GearDiagnostic, type SpurGearSpec, type SpurGearReport,
} from './gear.js';

/** Version 0 of the internal gear's inputs (lengths in mm). */
export interface InternalGearSpec {
  /** A straight ring's module; a helical one's `normalModuleMM`, helix angle and hand (its pinion's hand: an internal pair is of one hand). */
  readonly moduleMM?: number;
  readonly normalModuleMM?: number;
  readonly helixAngleDeg?: number;
  readonly hand?: 'right' | 'left';
  readonly teeth: number;
  readonly faceWidthMM: number;
  /** The rim's outer diameter. */
  readonly rimDiameterMM: number;
  /** 20° only in this stage. */
  readonly pressureAngleDeg?: number;
  /** x2: the tip at r − (1 − x2) m, the spaces 2 x2 m tan α wider; from −0.5 to 0.75. */
  readonly profileShiftCoefficient?: number;
  /** Taken off the ring's teeth at the reference circle (its spaces that much wider): its share of a pair's backlash. */
  readonly toothThicknessReductionMM?: number;
  /** The largest deviation of a fitted flank from the involute; default 1e-4 m. */
  readonly profileToleranceMM?: number;
  /** The least rim beyond the root circle; default 1 m (geometry only: not a strength check). */
  readonly minimumRimMM?: number;
}
export interface InternalGearReport {
  readonly generator: 'internal-gear@0';
  readonly dimensions: {
    readonly referenceDiameterMM: number; readonly baseDiameterMM: number;
    /** The tip circle (inside) and the root circle (outside), the rim's outer diameter. */
    readonly tipDiameterMM: number; readonly rootDiameterMM: number; readonly rimDiameterMM: number;
    readonly circularPitchMM: number; readonly spaceWidthMM: number; readonly toothThicknessMM: number;
  };
  readonly profileShift: number;
  readonly helix?: SpurGearReport['helix'];
  readonly flankPieces: number; readonly profileDeviationMM: number; readonly profileToleranceMM: number;
  readonly rootPolicy: 'schematic-corner'; readonly manufacturingValidated: false;
  readonly diagnostics: readonly GearDiagnostic[];
}

const MIN_SHIFT = -0.5, MAX_SHIFT = 0.75;

/** The ring's space gear (D129): the spur machinery's gear at x2 + 0.25 and thickened to the ring's spaces. */
function spaceSpecOf(spec: InternalGearSpec): SpurGearSpec {
  const helical = spec.helixAngleDeg !== undefined && spec.helixAngleDeg !== 0;
  const mn = (helical ? spec.normalModuleMM : spec.moduleMM) as number, cb = helical ? Math.cos(spec.helixAngleDeg! * Math.PI / 180) : 1, x2 = spec.profileShiftCoefficient ?? 0;
  // (The shift's extra 0.25 thickens the tooth by 2·0.25·m_t tan α_n; that, less the ring's reduction, is taken off.)
  const red = 0.5 * mn / cb * Math.tan(20 * Math.PI / 180) - (spec.toothThicknessReductionMM ?? 0);
  return { ...(helical ? { normalModuleMM: spec.normalModuleMM, helixAngleDeg: spec.helixAngleDeg, hand: spec.hand } : { moduleMM: spec.moduleMM }), teeth: spec.teeth, faceWidthMM: spec.faceWidthMM,
    ...(spec.pressureAngleDeg === undefined ? {} : { pressureAngleDeg: spec.pressureAngleDeg }), profileShiftCoefficient: x2 + 0.25, toothThicknessReductionMM: red, ...(spec.profileToleranceMM === undefined ? {} : { profileToleranceMM: spec.profileToleranceMM }) };
}

/** The ring's dimensions and input checks (refusals thrown, as GearError, in the ring's own terms). */
export function internalGearDimensions(spec: InternalGearSpec): {
  r: number; rb: number; ra: number; rf: number; rim: number; mn: number; mt: number; alpha: number; alphaN: number; beta: number; x: number;
  space: SpurGearSpec; sd: ReturnType<typeof spurGearDimensions>; spaceWidth: number; pitch: number;
} {
  const z = spec.teeth, x = spec.profileShiftCoefficient ?? 0;
  if (!(Number.isInteger(z) && z >= 8 && z <= 200)) throw new GearError('INVALID_INPUT', 'an internal gear takes a whole number of teeth from 8 to 200');
  if (!Number.isFinite(x)) throw new GearError('INVALID_INPUT', 'profileShiftCoefficient must be a number');
  if (!(x >= MIN_SHIFT && x <= MAX_SHIFT)) throw new GearError('UNSUPPORTED_PROFILE_SHIFT', `an internal gear's profile shift ${x}: from ${MIN_SHIFT} to ${MAX_SHIFT} in this stage`);
  const j = spec.toothThicknessReductionMM ?? 0;
  if (!(Number.isFinite(j) && j >= 0)) throw new GearError('INVALID_INPUT', 'toothThicknessReductionMM must be a number of mm, 0 or more');
  const space = spaceSpecOf(spec);
  if (!((space.toothThicknessReductionMM ?? 0) >= 0)) throw new GearError('INVALID_INPUT', `a thickness reduction of ${j} mm: at most ${(j + (space.toothThicknessReductionMM ?? 0)).toFixed(6)} mm in this stage (a quarter of the shift's tan α)`);
  let sd: ReturnType<typeof spurGearDimensions>;
  try { sd = spurGearDimensions(space); }
  catch (cause) {
    if (!(cause instanceof GearError)) throw cause;
    if (cause.code === 'SELF_INTERSECTION') throw new GearError('SELF_INTERSECTION', `the ring's spaces come to a point below its root circle (${z} teeth${x ? `, x = ${x}` : ''})`);
    if (cause.code === 'UNSUPPORTED_PROFILE_SHIFT') throw new GearError('UNSUPPORTED_PROFILE_SHIFT', `${z} teeth at x = ${x} are outside this stage`);
    throw cause;
  }
  const r = sd.r, rb = sd.rb, mn = sd.mn, ra = r - (1 - x) * mn, rf = r + (1.25 + x) * mn;
  // The ring's tip must stand on the involute: above its base circle (K1: z2 > 34 unshifted at 20°).
  if (!(ra >= rb)) throw new GearError('UNSUPPORTED_PROFILE_SHIFT', `the ring's tip circle Ø${(2 * ra).toFixed(4)} falls inside its base circle Ø${(2 * rb).toFixed(4)} (${z} teeth${x ? ` at x = ${x}` : ''}): a shift of at least x = ${(1 - (r - rb) / mn).toFixed(3)} lifts it`);
  const R = spec.rimDiameterMM / 2, rimMin = spec.minimumRimMM ?? mn;
  if (!(Number.isFinite(R) && R > 0)) throw new GearError('INVALID_INPUT', 'rimDiameterMM must be a number of mm above 0');
  if (!(R >= rf + rimMin)) throw new GearError('RIM_INTERSECTION', `a rim of Ø${spec.rimDiameterMM} mm leaves less than the ${rimMin} mm rim beyond the root circle (Ø${(2 * rf).toFixed(3)} mm): at least Ø${(2 * (rf + rimMin)).toFixed(3)} (a geometric margin, not a strength check)`);
  return { r, rb, ra, rf, rim: R, mn, mt: sd.mt, alpha: sd.alpha, alphaN: sd.alphaN, beta: sd.beta, x, space, sd, spaceWidth: sd.toothThicknessMM, pitch: sd.circularPitchMM };
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
  let prof: ReturnType<typeof spurGearProfile>;
  try { prof = spurGearProfile(d.space); }
  catch (cause) {
    if (cause instanceof GearError && cause.code === 'SELF_INTERSECTION') throw new GearError('SELF_INTERSECTION', `the ring's teeth come to a point at their tips (${z} teeth)`);
    throw cause;
  }
  // The space gear's pieces, turned by −π/z and named as the ring's: its tooth k is the ring's space before tooth k
  // (`root#k`), its root arc after it the ring's tip k, its right flank the ring's tooth k's left, its left flank the
  // ring's tooth k − 1's right. The hole runs clockwise: the pieces reversed.
  const nameOf = (role: string, k: number) => role === 'tip' ? `${id}.root#${k}` : role === 'root' ? `${id}.tip#${k}` : role === 'flankR' ? `${id}.flankL#${k}` : `${id}.flankR#${k === 1 ? z : k - 1}`;
  const inner = prof.pieces.map(p => ({ name: nameOf(p.role, p.tooth), curve: reversed(turned(p.curve, -Math.PI / z)) })).reverse();
  const rim = [{ name: `${id}.rim#1`, curve: arcCurve('m', d.rim, 0, Math.PI) }, { name: `${id}.rim#2`, curve: arcCurve('m', d.rim, Math.PI, Math.PI) }];
  const h = helixTwist(d.space, d.sd, prof.report.profileToleranceMM);
  const brep = extrudedProfile(id, 'gear', rim, inner, spec.faceWidthMM, d.rim + 1, h?.twist, 0, true);
  const report: InternalGearReport = {
    generator: 'internal-gear@0', profileShift: d.x,
    dimensions: { referenceDiameterMM: 2 * d.r, baseDiameterMM: 2 * d.rb, tipDiameterMM: 2 * d.ra, rootDiameterMM: 2 * d.rf, rimDiameterMM: 2 * d.rim, circularPitchMM: d.pitch, spaceWidthMM: d.spaceWidth, toothThicknessMM: d.pitch - d.spaceWidth },
    ...(h ? { helix: h.helix } : {}), flankPieces: prof.report.flankPieces, profileDeviationMM: prof.report.profileDeviationMM, profileToleranceMM: prof.report.profileToleranceMM,
    rootPolicy: 'schematic-corner', manufacturingValidated: false,
    diagnostics: [{ code: 'ROOT_TRANSITION_UNVALIDATED', severity: 'warning', message: 'the flanks meet the root arc at a corner: a schematic root, not the one the cutting tool (a pinion-type cutter) generates' }],
  };
  return { brep, report };
}

/**
 * Whether a pinion meshes inside the ring: the same (normal) module and pressure angle, both straight or both helical
 * at one angle and of one hand (an internal pair); else MATE_INCOMPATIBLE.
 */
function compatible(p: ReturnType<typeof spurGearDimensions>, d: ReturnType<typeof internalGearDimensions>): void {
  if (p.mn !== d.mn) throw new GearError('MATE_INCOMPATIBLE', `modules ${p.mn} and ${d.mn} mm do not mesh`);
  if (p.alphaN !== d.alphaN) throw new GearError('MATE_INCOMPATIBLE', 'pressure angles differ');
  if (p.beta !== d.beta) throw new GearError('MATE_INCOMPATIBLE', p.beta === 0 || d.beta === 0 ? 'a spur gear does not mesh with a helical ring, nor a helical gear with a straight one' : Math.abs(p.beta) !== Math.abs(d.beta) ? 'helix angles differ' : 'an internal pair is of one hand: the pinion and the ring both right or both left');
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
  if (!(dz > 0)) throw new GearError('MATE_INCOMPATIBLE', `a ${z1}-tooth pinion does not fit inside a ${z2}-tooth ring`);
  if (dx === 0) return aRef;
  const target = 2 * Math.tan(d.alphaN) * dx / dz + inv(d.alpha);
  if (!(target > 0)) throw new GearError('MATE_INCOMPATIBLE', `shifts differing by ${dx} on ${z2} − ${z1} teeth leave no working pressure angle`);
  let w = d.alpha;
  for (let i = 0; i < 50; i++) { const dw = (inv(w) - target) / (Math.tan(w) ** 2); w -= dw; if (!(w > 0 && w < Math.PI / 2)) throw new GearError('MATE_INCOMPATIBLE', 'no working pressure angle for these shifts'); if (Math.abs(dw) < 1e-15) break; }
  return aRef * Math.cos(d.alpha) / Math.cos(w);
}

export interface InternalGearPairOptions { readonly centerDistanceMM?: number; readonly relativePhaseDeg?: number; readonly samples?: number; readonly mode?: 'report' | 'verdict' }
export interface InternalGearPairCheck {
  readonly centerDistanceMM: number; readonly nominalCenterDistanceMM: number;
  readonly workingPressureAngleDeg: number;
  /** The pinion's and the ring's working pitch diameters, 2a z/(z2 − z1). */
  readonly workingPitchDiametersMM: readonly [number, number];
  /** +z1/z2: the ring turns the same way as the pinion. */
  readonly speedRatio: number;
  /** The ring's space less the pinion's tooth on their working pitch circles; negative: the teeth jam. */
  readonly backlashMM: number;
  /** The pinion's tip from the ring's root (rf2 − a − ra1), the ring's tip from the pinion's root (ra2 − a − rf1). */
  readonly tipClearancesMM: readonly [number, number];
  /** The formula's [√(ra1² − rb1²) − √(ra2² − rb2²) + a sin α_w]/(π m_t cos α_t), and the path the usable flanks allow. */
  readonly idealContactRatio: number; readonly usableContactRatio: number;
  readonly axialContactRatio: number; readonly totalContactRatio: number;
  /**
   * The interference conditions (derived, D129: K1's are equation images; checked against the sweep): the margins
   * z1/z2 − (1 − tan α_a2 / tan α_w) (involute) and θ1 z1/z2 + inv α_w − inv α_a2 − θ2 (trochoid), each ≥ 0 when clear
   * (Infinity: the tip circles never meet); `formMargin`, along the line of action, from where the pinion's involute starts
 * (its form circle, or max(rb, rf) under a schematic root) to where the ring's tip meets the line — negative when the
 * ring's tip runs below the pinion's involute, where the contact ends (the usable ratio) and the fillet passes it: not
 * a verdict, the sweep is (D132: mostly clear, 24 in 40 crossing); and the radial-insertion sweep for trimming — the pinion moved from the
   * ring's centre out to the working distance along the line of centres, in its meshing phase, its least clearance on
   * the way (`possible` false: its tip circle does not fit inside the ring's, so it cannot start there).
   */
  readonly interference: { readonly involuteMargin: number; readonly formMargin: number; readonly trochoidMargin: number; readonly trimming: { readonly possible: boolean; readonly interference: boolean; readonly leastClearanceMM: number; readonly atOffsetMM: number } };
  readonly sweep: { readonly samples: number; readonly minimumClearanceMM: number; readonly atDegrees: number; readonly interference: boolean; readonly converged: boolean; readonly coarseMinimumMM: number };
  readonly diagnostics: readonly GearDiagnostic[];
}

/**
 * A pinion inside a ring (R12b.2a): compatibility; the working geometry at the centre distance; backlash, tip
 * clearances, the contact ratio by the formula and by the usable flanks; the interference conditions; the radial
 * insertion; and the two exact outlines swept through one pinion tooth period (the ring turning z1/z2 the same way),
 * the least clearance converged and refined, a crossing measured by its depth — as the external pairs (D55), cached.
 */
export function checkInternalGearPair(pinion: SpurGearSpec, ring: InternalGearSpec, options: InternalGearPairOptions = {}): InternalGearPairCheck {
  const key = JSON.stringify([pinion, ring, options.centerDistanceMM ?? null, options.relativePhaseDeg ?? 0, options.samples ?? 64, options.mode ?? 'report']);
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
  const z1 = pinion.teeth, z2 = ring.teeth, m = d.mt, alpha = d.alpha, a0 = workingDistance(pinion, ring, p, d), a = options.centerDistanceMM ?? a0;
  if (!(Number.isFinite(a) && a > 0)) throw new GearError('INVALID_INPUT', 'centerDistanceMM must be a number of mm above 0');
  const cw = m * (z2 - z1) / 2 * Math.cos(alpha) / a;
  if (!(cw < 1)) throw new GearError('MATE_INCOMPATIBLE', `at ${a} mm no working pressure angle`);
  const alphaW = Math.acos(cw), rw1 = a * z1 / (z2 - z1), rw2 = a * z2 / (z2 - z1);
  // On the working pitch circles: the ring's space 2 rw2 (ψ_s − inv α_w) (ψ_s its space gear's half tooth at the base),
  // the pinion's tooth 2 rw1 (ψ1 − inv α_w).
  const backlash = 2 * rw2 * (d.sd.psi - inv(alphaW)) - 2 * rw1 * (p.psi - inv(alphaW));
  const tips: [number, number] = [d.rf - a - p.ra, d.ra - a - p.rf];
  const L = a * Math.sin(alphaW), hi1 = Math.sqrt(p.ra ** 2 - p.rb ** 2), lo1 = Math.sqrt(Math.max(0, p.rs ** 2 - p.rb ** 2)), ringTip = Math.sqrt(d.ra ** 2 - d.rb ** 2) - L;
  const pb = Math.PI * m * Math.cos(alpha), ideal = (hi1 - ringTip) / pb, usable = Math.max(0, hi1 - Math.max(lo1, ringTip, 0)) / pb;
  const epsB = Math.min(pinion.faceWidthMM, ring.faceWidthMM) * Math.abs(Math.sin(d.beta)) / (Math.PI * d.mn);
  // The conditions, transverse, at this distance.
  const aa1 = Math.acos(p.rb / p.ra), aa2 = Math.acos(d.rb / d.ra);
  const involuteMargin = z1 / z2 - (1 - Math.tan(aa2) / Math.tan(alphaW)), formMargin = ringTip - lo1;
  const c1 = (d.ra ** 2 - p.ra ** 2 - a * a) / (2 * a * p.ra), c2 = (a * a + d.ra ** 2 - p.ra ** 2) / (2 * a * d.ra);
  const trochoidMargin = Math.abs(c1) <= 1 && Math.abs(c2) <= 1 ? (Math.acos(c1) + inv(aa1) - inv(alphaW)) * z1 / z2 + inv(alphaW) - inv(aa2) - Math.acos(c2) : Infinity;
  const P1 = exactProfile(pinion, p), Q2 = exactProfile(d.space, d.sd), O: Outlines = { P: P1, Q: Q2, ra1: p.ra, ra2: d.ra, m: d.mn, Pa: anglesOf(P1), Qa: anglesOf(Q2) };
  // (Touching is not crossing: the ring's outline is chords of its involutes, which stand into its spaces by up to their
  // sag — rb t δt²/8 at the end of its flank, δt the step in roll — so a pinion on the true involute can seem that far
  // into the ring's material at contact. A crossing no deeper is contact, 0.)
  const phase = (options.relativePhaseDeg ?? 0) * Math.PI / 180, verdict = options.mode === 'verdict', touch = chordSag(d.sd) + 1e-9 * d.mn;
  const at = (theta: number) => { const c = clearanceAt(O, theta, theta * z1 / z2 + phase, a, verdict); return c < 0 && c >= -touch ? 0 : c; };
  const trimming = radialInsertion(O, a, phase, touch);
  const period = 2 * Math.PI / z1, N = Math.max(16, options.samples ?? 64), diagnostics: GearDiagnostic[] = [];
  if (involuteMargin < 0) diagnostics.push({ code: 'INVOLUTE_INTERFERENCE', severity: 'error', message: `involute interference: the ring's tip meets the pinion below its base circle (z1/z2 ${(z1 / z2).toFixed(4)} < 1 − tan α_a2 / tan α_w = ${(z1 / z2 - involuteMargin).toFixed(4)})` });
  if (trochoidMargin < 0) diagnostics.push({ code: 'TROCHOID_INTERFERENCE', severity: 'error', message: `trochoid interference: the pinion's tip strikes the ring's tooth as it leaves the mesh (margin ${trochoidMargin.toFixed(5)} rad; more teeth between them, or a shift, clears it)` });
  if (!trimming.possible) diagnostics.push({ code: 'TRIMMING_INTERFERENCE', severity: 'error', message: `radial assembly impossible: the pinion's tip circle Ø${(2 * p.ra).toFixed(4)} does not fit inside the ring's Ø${(2 * d.ra).toFixed(4)} — assemble it axially` });
  else if (trimming.interference) diagnostics.push({ code: 'TRIMMING_INTERFERENCE', severity: 'error', message: `trimming interference: moved in radially, the teeth cross ${trimming.atOffsetMM.toFixed(4)} mm from the ring's centre — assemble it axially` });
  const base = { centerDistanceMM: a, nominalCenterDistanceMM: a0, workingPressureAngleDeg: alphaW * 180 / Math.PI, workingPitchDiametersMM: [2 * rw1, 2 * rw2] as const, speedRatio: z1 / z2, backlashMM: backlash, tipClearancesMM: tips,
    idealContactRatio: ideal, usableContactRatio: usable, axialContactRatio: epsB, totalContactRatio: usable + epsB, interference: { involuteMargin, formMargin, trochoidMargin, trimming } };
  if (verdict) {
    let least = Infinity, tAt = 0;
    for (let i = 0; i < N; i++) { const t = period * i / N, c = at(t); if (c < least) { least = c; tAt = t; } if (c < 0) break; }
    const crossed = least < 0;
    if (crossed) diagnostics.push({ code: 'SELF_INTERSECTION', severity: 'error', message: `the teeth cross at ${(tAt * 180 / Math.PI).toFixed(4)}° of the pinion (the depth: a report)` });
    return { ...base, sweep: { samples: N, minimumClearanceMM: crossed ? -0 : least, atDegrees: tAt * 180 / Math.PI, interference: crossed, converged: false, coarseMinimumMM: least }, diagnostics };
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
  return { ...base, sweep: { samples: N, minimumClearanceMM: refined, atDegrees: tAt * 180 / Math.PI, interference: refined < 0, converged, coarseMinimumMM: coarse.c }, diagnostics };
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
function radialInsertion(O: Outlines, a: number, phase: number, touch: number): { possible: boolean; interference: boolean; leastClearanceMM: number; atOffsetMM: number } {
  if (!(O.ra1 < O.ra2)) return { possible: false, interference: true, leastClearanceMM: -0, atOffsetMM: 0 };
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
  return { possible: true, interference: refined < 0, leastClearanceMM: refined, atOffsetMM: where };
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
export interface PlacedInternalGearPairCheck extends InternalGearPairCheck { readonly relativePhaseDeg: number; readonly faceOverlapMM: number }

/**
 * The pinion's turn inside a ring as placed (R12b.2a): at direction φ from the ring's centre, a pinion tooth on the
 * line of centres in the ring's space there, following the ring's turn by z2/z1 the same way, plus `phase`.
 */
export function pinionTurnInside(ring: PlacedInternalGear, pinionTeeth: number, phi: number, phase: number): number {
  return phi + (ring.rotation - Math.PI / ring.spec.teeth - phi) * ring.spec.teeth / pinionTeeth + phase;
}
/** The pair checks for a pinion inside a ring as placed: the centre distance and the relative phase from where they stand and how they are turned. */
export function checkPlacedInternalGears(ring: PlacedInternalGear, pinion: { readonly spec: SpurGearSpec; readonly center: readonly [number, number]; readonly from: number; readonly rotation: number }, options: Omit<InternalGearPairOptions, 'centerDistanceMM' | 'relativePhaseDeg'> = {}): PlacedInternalGearPairCheck {
  const overlap = Math.min(ring.from + ring.spec.faceWidthMM, pinion.from + pinion.spec.faceWidthMM) - Math.max(ring.from, pinion.from);
  if (!(overlap > 0)) throw new GearError('MATE_INCOMPATIBLE', `the faces do not overlap along the axes (${overlap.toFixed(6)} mm)`);
  const dx = pinion.center[0] - ring.center[0], dy = pinion.center[1] - ring.center[1], a = Math.hypot(dx, dy);
  if (!(a > 0)) throw new GearError('MATE_INCOMPATIBLE', 'the pinion stands on the ring\'s axis');
  const phi = Math.atan2(dy, dx), z1 = pinion.spec.teeth, z2 = ring.spec.teeth, pitch = 2 * Math.PI / z2;
  // (Helical: both at the height where their faces begin to overlap, each turned along its helix — of one hand.)
  const zRef = Math.max(ring.from, pinion.from), d = internalGearDimensions(ring.spec), p = spurGearDimensions(pinion.spec);
  const rotR = ring.rotation + (zRef - ring.from) * Math.tan(d.beta) / d.r, rotP = pinion.rotation + (zRef - pinion.from) * Math.tan(p.beta) / p.r;
  // The ring's space gear stands at rotR − π/z2; seen with the pinion on +X, the ring's offset from turning with it.
  const raw = (rotR - Math.PI / z2 - phi) - (rotP - phi) * z1 / z2;
  let phase = ((raw % pitch) + pitch) % pitch; if (phase < 1e-9 * pitch || pitch - phase < 1e-9 * pitch) phase = 0;
  const phaseDeg = phase * 180 / Math.PI;
  const check = checkInternalGearPair(pinion.spec, ring.spec, { ...options, centerDistanceMM: a, relativePhaseDeg: phaseDeg });
  return { ...check, relativePhaseDeg: phaseDeg, faceOverlapMM: overlap };
}
