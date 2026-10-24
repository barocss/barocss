// R12b.5 (D136): cylindrical worms, ZI and ZA, and their cylindrical wheel (D129).
//
// A worm in its own frame: the axis +Z, from z 0 to its length, tooth (thread) 1 centred on +X in the section at z 0.
// Its transverse section (square to the axis) turns as it rises by z/p (p = lead / 2π = z1 m_x / 2; positive, counter-
// clockwise seen from +Z, for a right-hand thread), so the side faces are the section's curves swept by that turn —
// the helical gear's machinery (R6a.5c, D59) at the large helix angle 90° − γ. The proportions are the axial module
// system's: the reference diameter d1 (= q m_x), the lead angle tan γ = z1 m_x / d1, addendum m_x and dedendum 1.25 m_x,
// the thread's axial thickness π m_x / 2 at the reference cylinder, the normal pressure angle α_n 20° there.
// - ZI (the involute helicoid): the section is the involute of the base circle r1 cos α_t, tan α_t = tan α_n / sin γ —
//   a helical gear of z1 teeth at β = 90° − γ.
// - ZA (the straight axial profile, the lathe's): the axial section is a straight-sided rack at tan α_x = tan α_n /
//   cos γ, so the section is the Archimedean spiral whose half-thickness angle falls by tan α_x / p per mm outward.
// Both flanks are cubic Hermite fits on the section (the involute's roll, or the spiral's radius), the twist a Hermite
// fit of the rotation; each deviation measured, their sum within the profile tolerance (three quarters the section's,
// a quarter the twist's, as D135). The budgets are raised for worms, never the tolerance (D129): a flank of more than
// five pieces goes on several faces radially (16 poles a face), the twist up to 128 axial segments.
//
// The wheel is a cylindrical helical gear (`spurGear`) at β = γ, the worm's hand, its normal module m_x cos γ — a
// crossed helical pair at 90° with a ZI worm (point contact), conjugate to a ZA worm in the mid-plane only. The pair is
// checked by sections square to the wheel's axis: the wheel's transverse profile there, the worm's thread cut by the
// same plane (each section point of the worm's transverse outline carried to where its helix crosses the plane).
import type { Brep } from '../brep/brep-core.js';
import type { Curve, Point } from '../types.js';
import { gearError, inv, arcCurve, reversed, lineCurve, safeId, bezierKnots, flankPoles, flankDeviation, extrudedProfile, twistDeviation, exactProfile, spurGearDimensions, segmentsCross, pointSegment, type GearDiagnostic, type SpurGearSpec, type ProfileTwist } from './gear.js';

/** Version 0 of a cylindrical worm's inputs (lengths in mm). */
export interface WormSpec {
  /** The axial module m_x (the wheel's transverse module). */
  readonly axialModule: number;
  /** Threads (starts), 1–4. */
  readonly starts: number;
  /** The reference diameter d1 (q = d1 / m_x). */
  readonly diameter: number;
  readonly hand: 'right' | 'left';
  /** Along the axis. */
  readonly length: number;
  /** 'ZI' (the default) or 'ZA'; 'ZN', 'ZK' and 'ZC' are refused (named). */
  readonly form?: 'ZI' | 'ZA' | 'ZN' | 'ZK' | 'ZC';
  /** 'cylindrical' only: double-enveloping (globoid) worms are refused. */
  readonly envelope?: 'cylindrical' | 'double';
  /** The normal pressure angle at the reference cylinder: 20° only. */
  readonly pressureAngle?: number;
  readonly boreDiameter?: number;
  /** Thinned along the axis at the reference cylinder (backlash). */
  readonly toothThicknessReduction?: number;
  /** The flank fit plus the twist's, at most this; 1e-4 m_n by default. */
  readonly profileTolerance?: number;
}

export interface WormReport {
  readonly generator: 'worm@0'; readonly form: 'ZI' | 'ZA'; readonly envelope: 'cylindrical';
  readonly dimensions: {
    readonly referenceDiameter: number; readonly tipDiameter: number; readonly rootDiameter: number; readonly diameterQuotient: number;
    readonly leadAngle: number; readonly lead: number; readonly axialPitch: number; readonly normalModule: number; readonly length: number;
    /** ZI: the section's transverse pressure angle and base diameter; ZA: the axial pressure angle of its straight sides. */
    readonly transversePressureAngle?: number; readonly baseDiameter?: number; readonly axialPressureAngle?: number;
    readonly axialThickness: number;
  };
  readonly flankPieces: number; readonly flankFaces: number; readonly profileDeviation: number; readonly profileTolerance: number;
  readonly twist: { readonly turns: number; readonly pieces: number; readonly axialSegments: number; readonly deviation: number };
  readonly manufacturingValidated: false;
  readonly diagnostics: readonly GearDiagnostic[];
}

const ALPHA_N = 20 * Math.PI / 180, MAX_FLANK = 20, PER_FACE = 5, MAX_SEGMENTS = 128, PER_SEGMENT = 4;

/** The worm's dimensions and the values the solid and the pair need; refusals typed. */
export function wormDimensions(spec: WormSpec) {
  const m = spec.axialModule, z1 = spec.starts, d1 = spec.diameter, L = spec.length, form = spec.form ?? 'ZI';
  if (form === 'ZN' || form === 'ZK' || form === 'ZC') throw gearError('UNSUPPORTED_GEAR_KIND', `a ${form} worm (${form === 'ZN' ? 'straight in the normal section' : form === 'ZK' ? 'cut by a disc' : 'concave, circular in the axial section'}): ZI and ZA only in this stage`);
  if (form !== 'ZI' && form !== 'ZA') throw gearError('INVALID_INPUT', `worm form ${String(form)}: 'ZI' or 'ZA'`);
  if (spec.envelope !== undefined && spec.envelope !== 'cylindrical') throw gearError('UNSUPPORTED_GEAR_KIND', 'a double-enveloping (globoid) worm: cylindrical worms only in this stage');
  if ((spec.pressureAngle ?? 20) !== 20) throw gearError('UNSUPPORTED_GEAR_KIND', `pressure angle ${spec.pressureAngle}°: only 20° (normal, at the reference cylinder) in this stage`);
  if (!(Number.isFinite(m) && m > 0 && m <= 100)) throw gearError('INVALID_INPUT', 'axialModule must be a number of mm above 0, at most 100');
  if (!(Number.isInteger(z1) && z1 >= 1 && z1 <= 4)) throw gearError('INVALID_INPUT', 'starts must be a whole number from 1 to 4');
  if (spec.hand !== 'right' && spec.hand !== 'left') throw gearError('INVALID_INPUT', "a worm needs its hand, 'right' or 'left'");
  if (!(Number.isFinite(L) && L > 0 && L <= 10000)) throw gearError('INVALID_INPUT', 'length must be a number of mm above 0');
  const rf = d1 / 2 - 1.25 * m;
  if (!(Number.isFinite(d1) && rf > 0)) throw gearError('INVALID_INPUT', `diameter must leave a root: above ${(2.5 * m).toFixed(4)} mm (2.5 m_x)`);
  const r1 = d1 / 2, ra = r1 + m, gamma = Math.atan(z1 * m / d1), p = z1 * m / 2, h = spec.hand === 'right' ? 1 : -1, mn = m * Math.cos(gamma);
  if (!(gamma <= Math.PI / 4)) throw gearError('UNSUPPORTED_GEAR_KIND', `a lead angle of ${(gamma * 180 / Math.PI).toFixed(3)}° (q ${(d1 / m).toFixed(3)} for ${z1} starts): at most 45° in this stage`);
  const red = spec.toothThicknessReduction ?? 0;
  if (!(Number.isFinite(red) && red >= 0)) throw gearError('INVALID_INPUT', 'toothThicknessReduction must be a number of mm, 0 or more');
  const sx = Math.PI * m / 2 - red;
  if (!(sx > 0)) throw gearError('INVALID_INPUT', `a thickness reduction of ${red} mm leaves no thread (its axial thickness is ${(Math.PI * m / 2).toFixed(4)} mm)`);
  // The thread's half-thickness angle at r1 in the section: the axial half-thickness over p.
  const psiRef = sx / (2 * p);
  const alphaT = Math.atan(Math.tan(ALPHA_N) / Math.sin(gamma)), rb = r1 * Math.cos(alphaT), alphaX = Math.atan(Math.tan(ALPHA_N) / Math.cos(gamma));
  const psiAt = (r: number) => form === 'ZI' ? psiRef + inv(alphaT) - inv(Math.acos(Math.min(1, rb / r))) : psiRef - (r - r1) * Math.tan(alphaX) / p;
  const r0 = form === 'ZI' ? Math.max(rb, rf) : rf;
  if (!(psiAt(ra) > 0)) throw gearError('SELF_INTERSECTION', 'the thread comes to a point below its tip');
  if (!(Math.PI / z1 - psiAt(r0) > 1e-9)) throw gearError('SELF_INTERSECTION', 'neighbouring threads meet at the root');
  const bd = spec.boreDiameter ?? 0;
  if (!(Number.isFinite(bd) && bd >= 0)) throw gearError('INVALID_INPUT', 'boreDiameter must be a number of mm, 0 or more');
  if (bd > 0 && !(bd / 2 <= rf - m)) throw gearError('BORE_INTERSECTION', `a bore of ${bd} mm leaves less than the ${m} mm rim below the root (Ø${(2 * rf).toFixed(3)} mm): at most Ø${Math.max(0, 2 * (rf - m)).toFixed(3)} (a geometric margin, not a strength check)`);
  return { m, z1, d1, r1, ra, rf, rb, r0, gamma, p, h, mn, L, form, red, sx, psiRef, alphaT, alphaX, psiAt, bore: bd / 2 };
}
export type WormDimensions = ReturnType<typeof wormDimensions>;

/** A ZA flank: the spiral r ↦ r e^{−iψ(r)} (the tooth's lower side), C¹ Hermite pieces in r: 3N + 1 poles (z 0), turned by `turn`, mirrored first when `mirror`. */
function spiralPoles(g: WormDimensions, r0: number, r1: number, N: number, turn: number, mirror: boolean): Point[] {
  const c = Math.cos(turn), s = Math.sin(turn), k = Math.tan(g.alphaX) / g.p, out: Point[] = [];
  const put = (x: number, y: number) => { const yy = mirror ? -y : y; out.push([c * x - s * yy, s * x + c * yy, 0]); };
  for (let i = 0; i < N; i++) {
    const ra = r0 + (r1 - r0) * i / N, rb = r0 + (r1 - r0) * (i + 1) / N, hh = (rb - ra) / 3, aa = -g.psiAt(ra), ab = -g.psiAt(rb);
    // d/dr r e^{ia} = e^{ia}(1 + i r a'), a' = +tan α_x / p.
    const da = [Math.cos(aa) - ra * k * Math.sin(aa), Math.sin(aa) + ra * k * Math.cos(aa)], db = [Math.cos(ab) - rb * k * Math.sin(ab), Math.sin(ab) + rb * k * Math.cos(ab)];
    const A = [ra * Math.cos(aa), ra * Math.sin(aa)], B = [rb * Math.cos(ab), rb * Math.sin(ab)];
    if (i === 0) put(A[0], A[1]);
    put(A[0] + hh * da[0], A[1] + hh * da[1]); put(B[0] - hh * db[0], B[1] - hh * db[1]); put(B[0], B[1]);
  }
  return out;
}
/** The ZA flank fit's largest distance from the spiral (along the circle at each radius, a bound). */
function spiralDeviation(g: WormDimensions, r0: number, r1: number, N: number): number {
  const P = spiralPoles(g, r0, r1, N, 0, false);
  let worst = 0;
  for (let k = 0; k < N; k++) for (let i = 0; i <= 64; i++) {
    const s = i / 64, u = 1 - s, a = P[3 * k], b = P[3 * k + 1], c = P[3 * k + 2], d = P[3 * k + 3];
    const x = u * u * u * a[0] + 3 * u * u * s * b[0] + 3 * u * s * s * c[0] + s * s * s * d[0], y = u * u * u * a[1] + 3 * u * u * s * b[1] + 3 * u * s * s * c[1] + s * s * s * d[1], r = Math.hypot(x, y);
    let da = Math.atan2(y, x) + g.psiAt(r); da -= 2 * Math.PI * Math.round(da / (2 * Math.PI));
    worst = Math.max(worst, Math.abs(da) * r);
  }
  return worst;
}

interface Side { readonly name: string; readonly curve: Curve }

/**
 * A cylindrical worm (R12b.5, D136) as a solid in its own frame (axis +Z from z 0; thread 1 centred on +X at z 0). Faces
 * `<id>.flankL#k`, `.flankR#k` (thread k's sides; more than five pieces on more faces, root outward: `.flankL2#k` …),
 * `.tip#k`, `.root#k`, `.rootL#k`/`.rootR#k` (a ZI section's radial joins below its base circle), `.face0`, `.face1`,
 * `.bore#1/2`; along the axis in segments `.2` … as a helical gear's.
 */
export function worm(spec: WormSpec, options: { readonly id?: string } = {}): { brep: Brep; report: WormReport } {
  const id = safeId(options.id ?? 'worm'), g = wormDimensions(spec), tol = spec.profileTolerance ?? 1e-4 * g.mn;
  if (!(Number.isFinite(tol) && tol > 0)) throw gearError('INVALID_INPUT', 'profileTolerance must be a number of mm above 0');
  const secTol = 0.75 * tol, twistTol = tol - secTol;
  // The flank: ZI the involute's roll t0 → t1, ZA the spiral's radius; as few pieces as the section's share asks.
  const t0 = g.form === 'ZI' ? Math.sqrt(Math.max(0, (g.r0 / g.rb) ** 2 - 1)) : g.r0, t1 = g.form === 'ZI' ? Math.sqrt((g.ra / g.rb) ** 2 - 1) : g.ra;
  const devOf = (N: number) => g.form === 'ZI' ? flankDeviation(g.rb, t0, t1, N) : spiralDeviation(g, t0, t1, N);
  let N = 1, dev = devOf(1);
  while (dev > secTol && N < MAX_FLANK) dev = devOf(++N);
  if (dev > secTol) throw gearError('PROFILE_BUDGET_EXCEEDED', `a worm flank within ${secTol.toExponential(2)} mm needs more than ${MAX_FLANK} cubic pieces (${MAX_FLANK} come to ${dev.toExponential(2)} mm)`);
  const F = Math.ceil(N / PER_FACE);
  // The twist: L / p radians (right-hand: counter-clockwise seen from +Z as it rises), as few cubic pieces as its share asks.
  const angle = g.h * g.L / g.p;
  let K = 1; while (twistDeviation(Math.abs(angle) / K) * g.ra > twistTol && K < MAX_SEGMENTS * PER_SEGMENT) K++;
  const S = Math.ceil(K / PER_SEGMENT), NP = Math.ceil(K / S), twistDev = twistDeviation(Math.abs(angle) / (S * NP)) * g.ra;
  if (S > MAX_SEGMENTS || twistDev > twistTol) throw gearError('PROFILE_BUDGET_EXCEEDED', `the thread's twist of ${(angle / (2 * Math.PI)).toFixed(3)} turns within ${twistTol.toExponential(2)} mm needs more than ${MAX_SEGMENTS} axial segments`);
  const twist: ProfileTwist = { angle, segments: S, pieces: NP };
  // The section, counter-clockwise: per thread the root join (ZI under its base circle), the flanks, the tip, the root arc to the next.
  const step = 2 * Math.PI / g.z1, psi0 = g.psiAt(g.r0), psiTip = g.psiAt(g.ra), radial = g.form === 'ZI' && g.rf < g.rb, list: Side[] = [];
  const psiBase = g.psiRef + inv(g.alphaT);
  const flank = (j0: number, j1: number, turn: number, mirror: boolean): Curve => {
    const ta = t0 + (t1 - t0) * j0 / N, tb = t0 + (t1 - t0) * j1 / N, n = j1 - j0;
    const P = g.form === 'ZI' ? flankPoles(g.rb, ta, tb, n, turn, mirror) : spiralPoles(g, ta, tb, n, turn, mirror);
    return { kind: 'curve', id: 'f', degree: 3, knots: bezierKnots(n), controlPoints: P, weights: P.map(() => 1) };
  };
  for (let k = 0; k < g.z1; k++) {
    const gam = step * k, n = k + 1;
    // (ZI: the involute turned to γ − ψ_b (left) or mirrored and turned to γ + ψ_b (right); ZA: the spiral about the thread's middle.)
    const turnL = g.form === 'ZI' ? gam - psiBase : gam, turnR = g.form === 'ZI' ? gam + psiBase : gam;
    if (radial) list.push({ name: `${id}.rootL#${n}`, curve: lineCurve('l', [g.rf * Math.cos(gam - psiBase), g.rf * Math.sin(gam - psiBase), 0], [g.rb * Math.cos(gam - psiBase), g.rb * Math.sin(gam - psiBase), 0]) });
    for (let f = 0; f < F; f++) list.push({ name: `${id}.flankL${f ? f + 1 : ''}#${n}`, curve: flank(Math.round(N * f / F), Math.round(N * (f + 1) / F), turnL, false) });
    list.push({ name: `${id}.tip#${n}`, curve: arcCurve('t', g.ra, gam - psiTip, 2 * psiTip) });
    for (let f = F - 1; f >= 0; f--) list.push({ name: `${id}.flankR${f ? f + 1 : ''}#${n}`, curve: reversed(flank(Math.round(N * f / F), Math.round(N * (f + 1) / F), turnR, true)) });
    if (radial) list.push({ name: `${id}.rootR#${n}`, curve: lineCurve('l', [g.rb * Math.cos(gam + psiBase), g.rb * Math.sin(gam + psiBase), 0], [g.rf * Math.cos(gam + psiBase), g.rf * Math.sin(gam + psiBase), 0]) });
    list.push({ name: `${id}.root#${n}`, curve: arcCurve('r', g.rf, gam + psi0, step - 2 * psi0) });
  }
  const bore: Side[] = g.bore > 0 ? [{ name: `${id}.bore#1`, curve: arcCurve('b', g.bore, 0, -Math.PI) }, { name: `${id}.bore#2`, curve: arcCurve('b', g.bore, -Math.PI, -Math.PI) }] : [];
  const brep = extrudedProfile(id, 'gear', list, bore, g.L, g.ra + 1, twist);
  const deg = (x: number) => x * 180 / Math.PI, diagnostics: GearDiagnostic[] = [];
  if (radial) diagnostics.push({ code: 'ROOT_TRANSITION_UNVALIDATED', severity: 'warning', message: 'the section joins the root by radial lines from the base circle: a schematic root, not the one the thread tool cuts' });
  return { brep, report: { generator: 'worm@0', form: g.form, envelope: 'cylindrical',
    dimensions: { referenceDiameter: g.d1, tipDiameter: 2 * g.ra, rootDiameter: 2 * g.rf, diameterQuotient: g.d1 / g.m, leadAngle: deg(g.gamma), lead: 2 * Math.PI * g.p, axialPitch: Math.PI * g.m, normalModule: g.mn, length: g.L,
      ...(g.form === 'ZI' ? { transversePressureAngle: deg(g.alphaT), baseDiameter: 2 * g.rb } : { axialPressureAngle: deg(g.alphaX) }), axialThickness: g.sx },
    flankPieces: N, flankFaces: F, profileDeviation: dev, profileTolerance: tol, twist: { turns: g.L / (2 * Math.PI * g.p), pieces: S * NP, axialSegments: S, deviation: twistDev }, manufacturingValidated: false, diagnostics } };
}

/** The cylindrical worm wheel's spec (R12b.5): a helical gear at β = γ of the worm's hand, its normal module m_x cos γ. */
export function wormWheelSpec(w: WormSpec, wheel: { readonly teeth: number; readonly faceWidth: number } & Omit<SpurGearSpec, 'teeth' | 'faceWidth' | 'module' | 'normalModule' | 'helixAngle' | 'hand'>): SpurGearSpec {
  const g = wormDimensions(w);
  return { ...wheel, normalModule: g.mn, helixAngle: g.gamma * 180 / Math.PI, hand: w.hand };
}

// ——— The pair ———

/** `relativePhase`: the worm turned that much past meshing. */
export interface WormPairOptions { readonly relativePhase?: number; readonly samples?: number; readonly mode?: 'report' | 'verdict' }
export interface WormPairCheck {
  /** Crossed at 90°: (d1 + d2)/2 + x m_n. */
  readonly centerDistance: number;
  /** z2 / z1. */
  readonly speedRatio: number;
  /** Along the worm's axis at the reference: the worm's axial reduction and the wheel's transverse one. */
  readonly backlash: number;
  /** a − ra1 − rf2 and a − ra2 − rf1. */
  readonly tipClearances: readonly [number, number];
  /** In the mid-plane, the worm's axial section as a rack of addendum m_x (exact for ZA; an estimate for ZI, a crossed helical pair in point contact). */
  readonly midPlaneContactRatio: number;
  /** Where the worm's thread must reach along its axis for the wheel's tips (from the mid-plane point): the mesh zone's half-length. */
  readonly meshZoneHalfLength: number;
  /**
   * Sections square to the wheel's axis — the mid-plane and ±b/3 — each swept through one axial pitch of the worm, the
   * least clearance (refined in the mid-plane; a clearance of a module or more comes back as m_x), crossings; the
   * outlines are chords, their sag reported.
   */
  readonly planes: readonly { readonly offset: number; readonly minimumClearance: number; readonly interference: boolean }[];
  readonly interference: boolean; readonly chordSag: number;
  readonly diagnostics: readonly GearDiagnostic[];
}

function compatible(w: WormDimensions, wheel: SpurGearSpec, d2: ReturnType<typeof spurGearDimensions>): void {
  const beta = Math.abs(d2.beta), hand = d2.beta > 0 ? 'right' : d2.beta < 0 ? 'left' : null;
  if (!hand) throw gearError('MATE_INCOMPATIBLE', `a worm meshes with a helical wheel at its lead angle γ ${(w.gamma * 180 / Math.PI).toFixed(5)}°: this wheel is straight`);
  if ((hand === 'right' ? 1 : -1) !== w.h) throw gearError('MATE_INCOMPATIBLE', `the wheel is ${hand}-handed, the worm ${w.h > 0 ? 'right' : 'left'}-handed: a worm and its wheel at 90° are of one hand`);
  if (Math.abs(beta - w.gamma) > 1e-9) throw gearError('MATE_INCOMPATIBLE', `the wheel's helix angle ${(beta * 180 / Math.PI).toFixed(5)}° is not the worm's lead angle ${(w.gamma * 180 / Math.PI).toFixed(5)}°`);
  if (Math.abs(d2.mn - w.mn) > 1e-9 * w.mn) throw gearError('MATE_INCOMPATIBLE', `the wheel's normal module ${d2.mn} is not the worm's m_x cos γ = ${w.mn}`);
  if ((wheel.pressureAngle ?? 20) !== 20) throw gearError('MATE_INCOMPATIBLE', 'the pressure angles differ');
}

/**
 * The worm's exact transverse outline, all its threads (thread 1 centred on angle 0), from the first space's middle
 * round to it again: (ρ, φ) pairs, φ unwrapped (rising by 2π over the loop).
 */
export function wormOutline(g: WormDimensions): Float64Array {
  const F = 200, A = 24, step = 2 * Math.PI / g.z1, pts: number[] = [], psi0 = g.psiAt(g.r0), psiTip = g.psiAt(g.ra), psiBase = g.psiRef + inv(g.alphaT);
  let j = 0;
  const polar = (r: number, a: number) => { pts.push(r, a + j * step); };
  for (j = 0; j < g.z1; j++) {
  for (let i = 0; i <= A / 2; i++) polar(g.rf, -step / 2 + (step / 2 - psi0) * i / (A / 2));
  if (g.form === 'ZI' && g.rf < g.rb) polar(g.rb, -psiBase);
  for (let i = 0; i <= F; i++) { const r = g.r0 + (g.ra - g.r0) * i / F; polar(r, -g.psiAt(r)); }
  for (let i = 1; i < A; i++) polar(g.ra, -psiTip + 2 * psiTip * i / A);
  for (let i = F; i >= 0; i--) { const r = g.r0 + (g.ra - g.r0) * i / F; polar(r, g.psiAt(r)); }
  if (g.form === 'ZI' && g.rf < g.rb) polar(g.rf, psiBase);
  for (let i = 0; i <= A / 2; i++) polar(g.rf, psi0 + (step / 2 - psi0) * i / (A / 2));
  }
  return Float64Array.from(pts);
}
/** The outlines' chords' largest sag (the worm's flank chords against the curve at their middles, the wheel's likewise), a bound on how much larger a clearance may come out. */
function chordSags(g: WormDimensions, d2: ReturnType<typeof spurGearDimensions>): number {
  let w = 0, e = 0;
  const F = 200, at = (r: number) => [r * Math.cos(g.psiAt(r)), r * Math.sin(g.psiAt(r))];
  for (let i = 0; i < F; i++) {
    const ra = g.r0 + (g.ra - g.r0) * i / F, rb = g.r0 + (g.ra - g.r0) * (i + 1) / F, A = at(ra), B = at(rb), M = at((ra + rb) / 2);
    w = Math.max(w, pointSegment(M[0], M[1], A[0], A[1], B[0], B[1]));
  }
  const t0 = Math.sqrt(Math.max(0, (d2.rs / d2.rb) ** 2 - 1)), t1 = Math.sqrt((d2.ra / d2.rb) ** 2 - 1), inv2 = (t: number) => [d2.rb * (Math.cos(t) + t * Math.sin(t)), d2.rb * (Math.sin(t) - t * Math.cos(t))];
  for (let i = 0; i < 150; i++) {
    const A = inv2(t0 + (t1 - t0) * i / 150), B = inv2(t0 + (t1 - t0) * (i + 1) / 150), M = inv2(t0 + (t1 - t0) * (i + 0.5) / 150);
    e = Math.max(e, pointSegment(M[0], M[1], A[0], A[1], B[0], B[1]));
  }
  // (The middle parameter is not the farthest point exactly: a quarter more covers it.)
  return 1.25 * (w + e);
}

/**
 * The pair's frame: the wheel's axis +Z through the origin, its mid-plane z 0; the worm's axis along +X through (0, −a, 0),
 * its section's angle 0 toward the wheel (+Y) and π/2 toward +Z. The worm turned θ has a thread's middle, in the
 * mid-plane, at x = −θ p / h; the wheel's tooth k in the mid-plane at −π/2 − π/z2 − h θ z1/z2 + 2πk/z2 + phase (a space
 * facing the thread), each turning so their pitch points travel together.
 */
/** What the worm's section in a plane needs (R12b.6 cuts a throated wheel's by it too): its dimensions and outline, the centre distance, the mesh band. */
export interface WormSectionWork { readonly w: WormDimensions; readonly W: Float64Array; readonly a: number; readonly reach: number; readonly yLo: number; readonly yHi: number }
interface PairWork { readonly yLo: number; readonly yHi: number; readonly w: WormDimensions; readonly W: Float64Array; readonly G: { tooth: Float64Array; z: number }; readonly a: number; readonly r2: number; readonly ra2: number; readonly z2: number; readonly twist2: number; readonly verdict: boolean; readonly N: number; readonly phase: number; readonly reach: number }

/** The worm's section by the plane z = c, turned θ: each outline point (ρ, φ0) where its helix crosses the plane on the wheel's side, the copies a lead apart within ±reach of x 0 (segments x0 y0 x1 y1). */
export function wormSection(P: WormSectionWork, c: number, theta: number): Float64Array {
  const w = P.w, T = P.W, lead = 2 * Math.PI * w.p, out: number[] = [], n = T.length / 2;
  const kLo = Math.floor(-P.reach / lead) - 2, kHi = Math.ceil(P.reach / lead) + 2;
  for (let k = kLo; k <= kHi; k++) {
    let px = 0, py = 0, prev = false, pk = false;
    for (let i = 0; i < n; i++) {
      const rho = T[2 * i], phi0 = T[2 * i + 1];
      if (rho <= Math.abs(c)) { prev = false; continue; }
      const x = (Math.asin(c / rho) - phi0 - theta) * w.p / w.h + k * lead, y = Math.sqrt(rho * rho - c * c) - P.a;
      // (Only where the two can meet: within the mesh zone along the axis, and between the wheel's tip circle and the worm's crest line, a module more.)
      const keep = x > -P.reach && x < P.reach && y > P.yLo && y < P.yHi;
      if (prev && (keep || pk)) out.push(px, py, x, y);
      px = x; py = y; pk = keep; prev = true;
    }
  }
  return Float64Array.from(out);
}
/** The wheel's section by z = c: its transverse profile turned to the mid-plane tooth angle plus its twist to c, the teeth near the mesh. */
function wheelSection(P: PairWork, c: number, angle: number): Float64Array {
  const t = P.G.tooth, step = 2 * Math.PI / P.z2, out: number[] = [], A = angle + P.twist2 * c;
  for (let k = 0; k < P.z2; k++) {
    const ang = A + step * k; let d = ang + Math.PI / 2; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    if (Math.abs(d) > 4 * step) continue;
    const co = Math.cos(ang), si = Math.sin(ang);
    for (let i = 2; i + 1 < t.length; i += 2) {
      const x0 = co * t[i - 2] - si * t[i - 1], y0 = si * t[i - 2] + co * t[i - 1], x1 = co * t[i] - si * t[i + 1], y1 = si * t[i] + co * t[i + 1];
      if ((y0 > P.yLo && y0 < P.yHi && Math.abs(x0) < P.reach) || (y1 > P.yLo && y1 < P.yHi && Math.abs(x1) < P.reach)) out.push(x0, y0, x1, y1);
    }
  }
  return Float64Array.from(out);
}
/**
 * The least distance between the two sections (by a grid of a module's cells: past a module it comes back as one),
 * negative (−1) when they cross. Touching is not crossing:
 * two segments that cross by no more than `touch` (an end within it of the other) are in contact, at 0 — at no
 * backlash a ZA worm's mid-plane section and the wheel's touch along the line of action, and rounding makes them cross
 * by 1e-15 mm.
 */
export function planeClearance(A: Float64Array, B: Float64Array, touch: number, h: number): number {
  // (B's segments in a grid of cell h: an A segment meets only those in the cells about its box; nearer than h is all
  // the sweep asks — a clearance past h comes back as h, a module or more, which no meshing pair has.)
  const grid = new Map<number, number[]>();
  for (let j = 0; j < B.length; j += 4) {
    const i0 = Math.floor(Math.min(B[j], B[j + 2]) / h), i1 = Math.floor(Math.max(B[j], B[j + 2]) / h), k0 = Math.floor(Math.min(B[j + 1], B[j + 3]) / h), k1 = Math.floor(Math.max(B[j + 1], B[j + 3]) / h);
    for (let ix = i0; ix <= i1; ix++) for (let iy = k0; iy <= k1; iy++) { const key = ix * 1000003 + iy, list = grid.get(key); if (list) list.push(j); else grid.set(key, [j]); }
  }
  let best = h;
  for (let i = 0; i < A.length; i += 4) {
    const ax = A[i], ay = A[i + 1], bx = A[i + 2], by = A[i + 3], x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    const i0 = Math.floor(x0 / h) - 1, i1 = Math.floor(x1 / h) + 1, k0 = Math.floor(y0 / h) - 1, k1 = Math.floor(y1 / h) + 1;
    for (let ix = i0; ix <= i1; ix++) for (let iy = k0; iy <= k1; iy++) {
      const list = grid.get(ix * 1000003 + iy); if (!list) continue;
      for (let q = 0; q < list.length; q++) {
        const j = list[q], cx = B[j], cy = B[j + 1], dx = B[j + 2], dy = B[j + 3];
        const gx = Math.max(0, Math.min(cx, dx) - x1, x0 - Math.max(cx, dx)), gy = Math.max(0, Math.min(cy, dy) - y1, y0 - Math.max(cy, dy));
        if (gx * gx + gy * gy > best * best) continue;
        if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) {
          const dip = Math.min(Math.min(pointSegment(ax, ay, cx, cy, dx, dy), pointSegment(bx, by, cx, cy, dx, dy)), Math.min(pointSegment(cx, cy, ax, ay, bx, by), pointSegment(dx, dy, ax, ay, bx, by)));
          if (dip > touch) return -1;
          best = 0; continue;
        }
        const e = Math.min(pointSegment(ax, ay, cx, cy, dx, dy), pointSegment(bx, by, cx, cy, dx, dy), pointSegment(cx, cy, ax, ay, bx, by), pointSegment(dx, dy, ax, ay, bx, by));
        if (e < best) best = e;
      }
    }
  }
  return best;
}
// (The phase: the worm's own extra turn.)
const clearanceAt = (P: PairWork, c: number, th: number) => planeClearance(wormSection(P, c, th + P.phase), wheelSection(P, c, -Math.PI / 2 - Math.PI / P.z2 - P.w.h * th * P.w.z1 / P.z2), 1e-9 * P.a, P.w.m);
/** One axial pitch of the worm on the plane c: N samples (stopping at a crossing in verdict), refined by golden section when `refine`. */
function sweepPlane(P: PairWork, c: number, refine: boolean): number {
  const period = 2 * Math.PI / P.w.z1;
  let best = Infinity, at = 0;
  for (let i = 0; i < P.N; i++) { const t = period * i / P.N, d = clearanceAt(P, c, t); if (d < best) { best = d; at = t; } if (d < 0 && P.verdict) return d; }
  if (!refine || best < 0) return best;
  let lo = at - period / P.N, hi = at + period / P.N, x1 = hi - 0.618033988749895 * (hi - lo), x2 = lo + 0.618033988749895 * (hi - lo), f1 = clearanceAt(P, c, x1), f2 = clearanceAt(P, c, x2);
  for (let it = 0; it < 50 && hi - lo > 1e-9; it++) { if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - 0.618033988749895 * (hi - lo); f1 = clearanceAt(P, c, x1); } else { lo = x1; x1 = x2; f1 = f2; x2 = lo + 0.618033988749895 * (hi - lo); f2 = clearanceAt(P, c, x2); } }
  return Math.min(best, f1, f2);
}

/**
 * The worm pair's checks (R12b.5, D136): the wheel at the worm's lead angle and hand and normal module (else
 * MATE_INCOMPATIBLE, saying which); the centre distance, ratio, backlash and tip clearances; the mid-plane contact ratio;
 * and sections square to the wheel's axis at the mid-plane and ±b/3, each swept through one axial pitch of the worm.
 */
export function checkWormPair(w: WormSpec, wheel: SpurGearSpec, options: WormPairOptions = {}): WormPairCheck {
  const g = wormDimensions(w), d2 = spurGearDimensions(wheel);
  compatible(g, wheel, d2);
  const x2 = wheel.profileShiftCoefficient ?? 0, r2 = d2.r, a = g.r1 + r2 + x2 * d2.mn, z2 = wheel.teeth, ra2 = d2.ra, rf2 = d2.rf;
  const tips: [number, number] = [a - g.ra - rf2, a - ra2 - g.rf];
  // (The mid-plane: a rack of the worm's axial pitch π m_x, its working addendum m_x less the wheel's shift, at α_t2.)
  const at2 = d2.alpha, epsMid = (Math.sqrt(ra2 * ra2 - d2.rb * d2.rb) - r2 * Math.sin(at2) + (g.m - x2 * d2.mn) / Math.sin(at2)) / (Math.PI * g.m * Math.cos(at2));
  const reach = Math.sqrt(Math.max(0, ra2 * ra2 - (a - g.ra) ** 2));
  const P: PairWork = { yLo: -ra2 - g.m, yHi: -(a - g.ra) + g.m, w: g, W: wormOutline(g), G: exactProfile(wheel, d2), a, r2, ra2, z2, twist2: Math.tan(d2.beta) / r2, verdict: options.mode === 'verdict', N: Math.max(16, options.samples ?? 64), phase: (options.relativePhase ?? 0) * Math.PI / 180, reach: reach + Math.PI * g.m };
  const b2 = wheel.faceWidth, planes = [0, -b2 / 3, b2 / 3].map(c => { const d = sweepPlane(P, c, c === 0); return { offset: c, minimumClearance: d, interference: d < 0 }; });
  const crossed = planes.filter(x => x.interference), diagnostics: GearDiagnostic[] = [];
  if (crossed.length) diagnostics.push({ code: 'SELF_INTERSECTION', severity: 'error', message: `the worm's thread and the wheel's teeth cross in the section${crossed.length > 1 ? 's' : ''} ${crossed.map(x => x.offset.toFixed(3)).join(', ')} mm from the wheel's mid-plane` });
  if (g.L < 2 * reach) diagnostics.push({ code: 'INVALID_INPUT', severity: 'warning', message: `the worm's ${g.L} mm is shorter than the mesh zone (${(2 * reach).toFixed(3)} mm, where the wheel's tips reach its thread): the wheel's teeth run off its ends` });
  const sag = chordSags(g, d2);
  return { centerDistance: a, speedRatio: z2 / g.z1, backlash: g.red + (wheel.toothThicknessReduction ?? 0), tipClearances: tips, midPlaneContactRatio: epsMid, meshZoneHalfLength: reach, planes, interference: crossed.length > 0, chordSag: sag, diagnostics };
}

// ——— Placed ———

/** A worm as it stands: its frame's origin (the axis at z 0), its axis (local Z) and local X in the part, its turn about the axis (radians). */
export interface PlacedWorm { readonly spec: WormSpec; readonly origin: Point; readonly axis: Point; readonly xAxis: Point; readonly rotation: number }
/** A wheel as placed (a helical spur gear's GearPlacement's own terms): its spec, centre, face plane and turn. */
export interface PlacedWormWheel { readonly spec: SpurGearSpec; readonly center: readonly [number, number]; readonly from: number; readonly rotation: number }
export interface PlacedWormPairCheck extends WormPairCheck { readonly relativePhase: number }

/**
 * Where a worm meshing with `wheel` stands (R12b.5): its axis square to the wheel's, at the centre distance along the
 * direction φ (radians from +X about the wheel's axis), in the wheel's mid-plane, its length centred on the line of
 * centres; its local X toward the wheel; turned so a thread meets a space of the wheel in the mid-plane (plus `phase`,
 * radians of the worm's turn).
 */
export function wormPlacement(wheel: PlacedWormWheel, w: WormSpec, phi: number, phase: number): PlacedWorm {
  const g = wormDimensions(w), d2 = spurGearDimensions(wheel.spec);
  compatible(g, wheel.spec, d2);
  const a = g.r1 + d2.r + (wheel.spec.profileShiftCoefficient ?? 0) * d2.mn, t: Point = [-Math.sin(phi), Math.cos(phi), 0];
  const zm = wheel.from + wheel.spec.faceWidth / 2, mid: Point = [wheel.center[0] + a * Math.cos(phi), wheel.center[1] + a * Math.sin(phi), zm];
  return { spec: w, origin: [mid[0] - t[0] * g.L / 2, mid[1] - t[1] * g.L / 2, mid[2]], axis: t, xAxis: [-Math.cos(phi), -Math.sin(phi), 0], rotation: wormTurnFor(wheel, g, d2, phi) + phase };
}
/** The worm's turn meshing with the wheel as it stands: θ from the wheel's mid-plane tooth angle (in the pair's frame), less the half length's twist. */
function wormTurnFor(wheel: PlacedWormWheel, g: WormDimensions, d2: ReturnType<typeof spurGearDimensions>, phi: number): number {
  const z2 = wheel.spec.teeth, mid = wheel.rotation + Math.tan(d2.beta) * wheel.spec.faceWidth / 2 / d2.r - (phi + Math.PI / 2);
  // mid = −π/2 − π/z2 − h θ z1/z2 (mod 2π/z2) ⇒ θ; the worm's turn ρ = θ − h (L/2)/p.
  const theta = (-Math.PI / 2 - Math.PI / z2 - mid) * z2 / (g.h * g.z1);
  return theta - g.h * (g.L / 2) / g.p;
}
/** The placed worm's map from its own frame into the part: row-major 3 × 3 and the offset. */
export function wormMatrix(p: PlacedWorm): { matrix: [number, number, number, number, number, number, number, number, number]; offset: Point } {
  const Z = p.axis, X = p.xAxis, Y: Point = [Z[1] * X[2] - Z[2] * X[1], Z[2] * X[0] - Z[0] * X[2], Z[0] * X[1] - Z[1] * X[0]], c = Math.cos(p.rotation), s = Math.sin(p.rotation);
  return { matrix: [X[0] * c + Y[0] * s, -X[0] * s + Y[0] * c, Z[0], X[1] * c + Y[1] * s, -X[1] * s + Y[1] * c, Z[1], X[2] * c + Y[2] * s, -X[2] * s + Y[2] * c, Z[2]], offset: [...p.origin] as Point };
}
/**
 * The pair checks for a worm and wheel as placed: the axes square, the worm's axis in the wheel's mid-plane, at the
 * centre distance (else MATE_INCOMPATIBLE); the relative phase from the worm's turn against the one meshing with the
 * wheel as it stands (modulo a worm pitch's turn), then `checkWormPair`.
 */
export function checkPlacedWormPair(wheel: PlacedWormWheel, wp: PlacedWorm, options: Omit<WormPairOptions, 'relativePhase'> = {}): PlacedWormPairCheck {
  const g = wormDimensions(wp.spec), d2 = spurGearDimensions(wheel.spec);
  compatible(g, wheel.spec, d2);
  const Z = wp.axis, mid: Point = [wp.origin[0] + Z[0] * g.L / 2, wp.origin[1] + Z[1] * g.L / 2, wp.origin[2] + Z[2] * g.L / 2];
  if (Math.abs(Z[2]) > 1e-12) throw gearError('MATE_INCOMPATIBLE', 'the worm\'s axis is not square to the wheel\'s');
  const dx = mid[0] - wheel.center[0], dy = mid[1] - wheel.center[1], phi = Math.atan2(dy, dx), a = g.r1 + d2.r + (wheel.spec.profileShiftCoefficient ?? 0) * d2.mn;
  if (Math.abs(Math.hypot(dx, dy) - a) > 1e-9 * a || Math.abs(mid[2] - (wheel.from + wheel.spec.faceWidth / 2)) > 1e-9 * a || Math.abs(Z[0] * Math.cos(phi) + Z[1] * Math.sin(phi)) > 1e-12) throw gearError('MATE_INCOMPATIBLE', `the worm is not at the centre distance ${a.toFixed(4)} mm in the wheel's mid-plane, its axis square to the line of centres`);
  const pitch = 2 * Math.PI / g.z1, raw = wp.rotation - wormTurnFor(wheel, g, d2, phi);
  let phase = ((raw % pitch) + pitch) % pitch; if (phase < 1e-9 * pitch || pitch - phase < 1e-9 * pitch) phase = 0;
  const deg = phase * 180 / Math.PI;
  return { ...checkWormPair(wp.spec, wheel.spec, { ...options, relativePhase: deg }), relativePhase: deg };
}
