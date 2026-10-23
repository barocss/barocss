// R6a.5b (owner issue #2167, D58): the rack — a straight bar cut to the basic rack profile, meshing with a spur gear —
// and the gear-and-rack checks.
//
// The basic rack (20°): straight flanks at α from the normal of the pitch line, addendum m above it, dedendum 1.25 m
// below, the tooth πm/2 thick on the pitch line less the rack's thickness reduction; flat tips and roots. A gear meshes
// with it when its axis stands r + x m from the pitch line (its reference circle rolling on the rack's line shifted by
// x m): the working pressure angle stays α whatever the distance, and a gear d farther away than that opens the
// backlash by 2 d tan α (circumferential, along the pitch line). The contact ratio (textbook, as KHK's):
// εα = [√(ra² − rb²) − r sin α + (m − x m − d)/sin α] / (π m cos α), the rack's part limited too by where the gear's
// usable flank starts (max(rb, rf); a generated root's form circle, R12b.1a). As the gear turns θ, the rack travels r θ; the configuration repeats every pitch.
//
// R12b.1b (D131): the rack's root fillet (`rootPolicy: 'filleted'`, generator spur-rack@1) — the basic rack's own,
// radius ρ (0.38 m by default), tangent to the flank and the root line; in a helical rack's transverse section the
// ellipse a = ρ / cos β along the rack, b = ρ across (the normal section's circle, cut at β), exact as a rational arc.
import type { Brep } from '../brep-core.js';
import type { Curve } from '../types.js';
import {
  GearError, inv, spurGearDimensions, extrudedProfile, safeId, lineCurve, exactProfile, teethNear, nearSegments, segmentsCross, segmentDistance, pointSegment, orient,
  type GearDiagnostic, type SpurGearSpec,
} from './gear.js';

/** Version 0 of the rack's inputs (lengths in mm). */
export interface SpurRackSpec {
  /** A straight rack's module. (A helical rack's is `normalModuleMM`.) */
  readonly moduleMM?: number;
  /**
   * A helical rack (R6a.5c, D60): the normal module, the teeth inclined at β to the gear axis and its hand — the label
   * of the z → ∞ external gear it is, so it meshes with gears of the opposite hand: a left-hand rack's teeth slide
   * +X by z tan β (teeth toward +Y), meshing with right-hand gears.
   */
  readonly normalModuleMM?: number;
  readonly helixAngleDeg?: number;
  readonly hand?: 'right' | 'left';
  /** Teeth along its length; the rack is teeth × πm long, a half gap at each end. */
  readonly teeth: number;
  readonly faceWidthMM: number;
  /** From the pitch line to the back of the bar (more than the dedendum 1.25 m plus a rim of m). */
  readonly heightMM: number;
  /** 20° only in this stage. */
  readonly pressureAngleDeg?: number;
  /** Circumferential thickness taken off each tooth on the pitch line (the rack's share of the backlash). */
  readonly toothThicknessReductionMM?: number;
  /** The root: 'schematic-corner' (the default; spur-rack@0) or 'filleted' (R12b.1b, D131; spur-rack@1), radius `rootFilletRadiusMM` (default 0.38 m). */
  readonly rootPolicy?: 'schematic-corner' | 'filleted';
  readonly rootFilletRadiusMM?: number;
}
export interface SpurRackReport {
  readonly generator: 'spur-rack@0' | 'spur-rack@1';
  readonly lengthMM: number; readonly pitchMM: number; readonly toothThicknessMM: number; readonly tipWidthMM: number; readonly rootWidthMM: number;
  readonly addendumMM: number; readonly dedendumMM: number;
  /** A helical rack's: β, its hand label, the normal module, and how far its teeth slide along it per mm up the face. */
  readonly helix?: { readonly helixAngleDeg: number; readonly hand: 'right' | 'left'; readonly normalModuleMM: number; readonly shear: number };
  /** A filleted root's (R12b.1b): its radius, and how deep below the pitch line the straight flank ends (where the fillet starts). */
  readonly rootFillet?: { readonly radiusMM: number; readonly flankEndDepthMM: number };
  readonly diagnostics: readonly GearDiagnostic[];
}

const MAX_RACK_TEETH = 500;

/** The rack's dimensions and its input checks (refusals thrown, as GearError). */
export function spurRackDimensions(spec: SpurRackSpec): SpurRackReport & { alpha: number; alphaN: number; s: number; mn: number; beta: number; shear: number; fillet?: RackFillet } {
  const n = spec.teeth, H = spec.heightMM, helical = spec.helixAngleDeg !== undefined && spec.helixAngleDeg !== 0;
  let m: number, beta = 0;
  if (helical) {
    const bd = spec.helixAngleDeg!;
    if (spec.moduleMM !== undefined) throw new GearError('INVALID_INPUT', 'a helical rack takes normalModuleMM (the normal module), not moduleMM');
    if (!(Number.isFinite(bd) && bd > 0 && bd <= 45)) throw new GearError('UNSUPPORTED_GEAR_KIND', `helix angle ${bd}°: from above 0 to 45° in this stage`);
    if (spec.hand !== 'right' && spec.hand !== 'left') throw new GearError('INVALID_INPUT', "a helical rack needs its hand, 'right' or 'left'");
    m = spec.normalModuleMM as number; beta = (spec.hand === 'right' ? 1 : -1) * bd * Math.PI / 180;
  } else {
    if (spec.normalModuleMM !== undefined || spec.hand !== undefined) throw new GearError('INVALID_INPUT', 'normalModuleMM and hand belong to a helical rack: give helixAngleDeg too (a straight rack takes moduleMM)');
    m = spec.moduleMM as number;
  }
  if (!(Number.isFinite(m) && m > 0 && m <= 100)) throw new GearError('INVALID_INPUT', `${helical ? 'normalModuleMM' : 'moduleMM'} must be a number of mm above 0, at most 100`);
  if (!(Number.isInteger(n) && n >= 1 && n <= MAX_RACK_TEETH)) throw new GearError('INVALID_INPUT', `teeth must be a whole number from 1 to ${MAX_RACK_TEETH}`);
  if (!(Number.isFinite(spec.faceWidthMM) && spec.faceWidthMM > 0 && spec.faceWidthMM <= 10000)) throw new GearError('INVALID_INPUT', 'faceWidthMM must be a number of mm above 0');
  const alphaDeg = spec.pressureAngleDeg ?? 20;
  if (alphaDeg !== 20) throw new GearError('UNSUPPORTED_GEAR_KIND', `pressure angle ${alphaDeg}°: only 20° in this stage`);
  // (Helical: the transverse section — pitch π m_t, pressure angle α_t, heights in m_n — sliding along the rack as it
  // rises: −tan β for a right-hand label, +tan β for a left.)
  const cb = Math.cos(beta), alpha = Math.atan(Math.tan(alphaDeg * Math.PI / 180) / cb), ha = m, hf = 1.25 * m, p = Math.PI * m / cb, t = Math.tan(alpha), shear = -Math.tan(beta);
  if (!(Number.isFinite(H) && H >= hf + m)) throw new GearError('INVALID_INPUT', `heightMM must be at least the dedendum and a rim of one module, ${(hf + m).toFixed(4)} mm (a geometric margin, not a strength check)`);
  const red = spec.toothThicknessReductionMM ?? 0;
  if (!(Number.isFinite(red) && red >= 0)) throw new GearError('INVALID_INPUT', 'toothThicknessReductionMM must be a number of mm, 0 or more');
  const s = p / 2 - red, tip = s - 2 * ha * t, root = p - s - 2 * hf * t;
  if (!(tip > 0)) throw new GearError('SELF_INTERSECTION', 'the rack tooth comes to a point below its tip line');
  if (!(root > 0)) throw new GearError('SELF_INTERSECTION', 'neighbouring rack teeth meet at the root');
  const filleted = spec.rootPolicy === 'filleted';
  if (spec.rootPolicy !== undefined && spec.rootPolicy !== 'schematic-corner' && !filleted) throw new GearError('INVALID_INPUT', `root policy ${String(spec.rootPolicy)}: 'schematic-corner' or 'filleted'`);
  if (!filleted && spec.rootFilletRadiusMM !== undefined) throw new GearError('INVALID_INPUT', "rootFilletRadiusMM belongs to a filleted root (rootPolicy 'filleted')");
  const fillet = filleted ? rackFillet(spec.rootFilletRadiusMM ?? 0.38 * m, beta, alpha, hf, root) : undefined;
  return { generator: filleted ? 'spur-rack@1' : 'spur-rack@0', lengthMM: n * p, pitchMM: p, toothThicknessMM: s, tipWidthMM: tip, rootWidthMM: root, addendumMM: ha, dedendumMM: hf,
    ...(fillet ? { rootFillet: { radiusMM: fillet.rho, flankEndDepthMM: fillet.depth } } : {}),
    diagnostics: fillet ? [] : [{ code: 'ROOT_TRANSITION_UNVALIDATED', severity: 'warning', message: 'the flanks meet the root line at a corner: a schematic root, not the cutting tool\'s' }], alpha, alphaN: alphaDeg * Math.PI / 180, s, mn: m, beta, shear, ...(fillet ? { fillet } : {}) };
}

/**
 * A filleted root's fillet on the gap side of a tooth's right flank (R12b.1b, D131), as offsets from the corner where
 * the flank would meet the root line: the ellipse (a = ρ / cos β along, b = ρ across; a circle when straight) tangent to
 * the root line `dx` along it from the corner, its centre `cx` from the corner and b above the root, and tangent to the
 * flank at the angle θ_T (π + atan((b/a) tan α), the third quadrant), `depth` below the pitch line. Two of them must
 * leave a flat on the root, else refused naming the largest ρ.
 */
export interface RackFillet { readonly rho: number; readonly a: number; readonly b: number; readonly dx: number; readonly thetaT: number; readonly depth: number }
function rackFillet(rho: number, beta: number, alpha: number, hf: number, rootWidth: number): RackFillet {
  const a = beta ? rho / Math.cos(beta) : rho, b = rho, t = Math.tan(alpha), ca = Math.cos(alpha), sa = Math.sin(alpha);
  const reach = beta ? Math.sqrt(a * a * ca * ca + b * b * sa * sa) : rho, k = reach / rho, rhoMax = rootWidth / (2 * (k / ca - t));
  if (!(Number.isFinite(rho) && rho > 0 && rho < rhoMax)) throw new GearError('INVALID_INPUT', `rootFilletRadiusMM must be above 0 and below ${rhoMax.toFixed(6)} mm (where the two fillets of a gap meet)`);
  // The centre: b above the root line and, from the flank's foot, along the root by reach / cos α − b tan α.
  const dx = reach / ca - b * t, thetaT = Math.PI + Math.atan(b / a * t);
  return { rho, a, b, dx, thetaT, depth: hf - b - b * Math.sin(thetaT) };
}
/** A rational quadratic arc of the ellipse about (cx, cy), semi-axes a, b, from angle t0 by sweep (|sweep| < π/2). */
function ellipseArc(cx: number, cy: number, a: number, b: number, t0: number, sweep: number): Curve {
  const tm = t0 + sweep / 2, t1 = t0 + sweep, w = Math.cos(sweep / 2), mid = 1 / w;
  return { kind: 'curve', id: 'e', degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [[cx + a * Math.cos(t0), cy + b * Math.sin(t0), 0], [cx + a * mid * Math.cos(tm), cy + b * mid * Math.sin(tm), 0], [cx + a * Math.cos(t1), cy + b * Math.sin(t1), 0]], weights: [1, w, 1] };
}

/**
 * The rack as a solid: its pitch line along +X from x 0 (tooth k centred at (k − ½)πm), teeth toward +Y, the back at
 * y = −height, pulled from z 0 through the face width. Faces `<id>.flankL#k`, `.flankR#k`, `.tip#k`, `.root#k` (the gap
 * before tooth k; `#n+1` the end gap), `.back`, `.end0`/`.end1` (x 0 / the far end), `.face0`/`.face1`; a filleted
 * root's `.filletL#k`, `.filletR#k` (R12b.1b).
 */
export function spurRack(spec: SpurRackSpec, options: { readonly id?: string } = {}): { brep: Brep; report: SpurRackReport } {
  const id = safeId(options.id ?? 'rack'), d = spurRackDimensions(spec), m = d.mn, H = spec.heightMM, n = spec.teeth;
  const p = d.pitchMM, t = Math.tan(d.alpha), ha = d.addendumMM, hf = d.dedendumMM, L = d.lengthMM;
  const out: { name: string; curve: Curve }[] = [], line = (name: string, a: [number, number], b: [number, number]) => out.push({ name, curve: lineCurve('l', [a[0], a[1], 0], [b[0], b[1], 0]) });
  // Counter-clockwise: along the back, up the far end, the teeth from the far end back to x 0, down the near end.
  line(`${id}.back`, [0, -H], [L, -H]);
  line(`${id}.end1`, [L, -H], [L, -hf]);
  let x = L;
  const f = d.fillet;
  for (let k = n; k >= 1; k--) {
    const c = p * (k - 0.5), rootR = c + d.s / 2 + hf * t, tipR = c + d.s / 2 - ha * t, tipL = c - d.s / 2 + ha * t, rootL = c - d.s / 2 - hf * t;
    if (f) {
      // The fillets (R12b.1b): down the right side the root runs to the fillet's foot, the fillet turns up to the flank
      // (clockwise round its centre), the flank to the tip; the left side mirrored.
      const cR = rootR + f.dx, cL = rootL - f.dx, cy = -hf + f.b, tR: [number, number] = [cR + f.a * Math.cos(f.thetaT), cy + f.b * Math.sin(f.thetaT)], tL: [number, number] = [2 * c - tR[0], tR[1]];
      line(`${id}.root#${k + 1}`, [x, -hf], [cR, -hf]);
      out.push({ name: `${id}.filletR#${k}`, curve: ellipseArc(cR, cy, f.a, f.b, 1.5 * Math.PI, f.thetaT - 1.5 * Math.PI) });
      line(`${id}.flankR#${k}`, tR, [tipR, ha]);
      line(`${id}.tip#${k}`, [tipR, ha], [tipL, ha]);
      line(`${id}.flankL#${k}`, [tipL, ha], tL);
      out.push({ name: `${id}.filletL#${k}`, curve: ellipseArc(cL, cy, f.a, f.b, Math.PI - f.thetaT, -Math.PI / 2 - (Math.PI - f.thetaT)) });
      x = cL;
      continue;
    }
    line(`${id}.root#${k + 1}`, [x, -hf], [rootR, -hf]);
    line(`${id}.flankR#${k}`, [rootR, -hf], [tipR, ha]);
    line(`${id}.tip#${k}`, [tipR, ha], [tipL, ha]);
    line(`${id}.flankL#${k}`, [tipL, ha], [rootL, -hf]);
    x = rootL;
  }
  line(`${id}.root#1`, [x, -hf], [0, -hf]);
  line(`${id}.end0`, [0, -hf], [0, -H]);
  const brep = extrudedProfile(id, 'gear', out, [], spec.faceWidthMM, L + H + m + Math.abs(d.shear) * spec.faceWidthMM, undefined, d.shear);
  const report: SpurRackReport = { generator: d.generator, lengthMM: d.lengthMM, pitchMM: d.pitchMM, toothThicknessMM: d.toothThicknessMM, tipWidthMM: d.tipWidthMM, rootWidthMM: d.rootWidthMM, addendumMM: d.addendumMM, dedendumMM: d.dedendumMM, ...(d.beta ? { helix: { helixAngleDeg: spec.helixAngleDeg!, hand: spec.hand!, normalModuleMM: d.mn, shear: d.shear } } : {}), ...(d.rootFillet ? { rootFillet: d.rootFillet } : {}), diagnostics: d.diagnostics };
  return { brep, report };
}

/** Options of the gear-and-rack check: the gear axis's distance from the rack's pitch line, the rack slid off its meshing place. */
export interface SpurRackPairOptions { readonly centerDistanceMM?: number; readonly rackPhaseMM?: number; readonly samples?: number; readonly mode?: 'report' | 'verdict' }
export interface SpurRackPairCheck {
  /** The gear axis from the rack's pitch line, and where it meshes without backlash (r + x m). */
  readonly centerDistanceMM: number; readonly nominalCenterDistanceMM: number;
  readonly workingPressureAngleDeg: number;
  /** Along the pitch line: the two reductions plus 2 d tan α (d: the distance beyond nominal); negative: the teeth jam. */
  readonly backlashMM: number;
  /** The gear's tip from the rack's root line, the rack's tip from the gear's root circle (0.25 m each, unshifted at nominal). */
  readonly tipClearancesMM: readonly [number, number];
  readonly idealContactRatio: number; readonly usableContactRatio: number;
  /** Helical: εβ = b sin β / (π m_n) over the narrower face, and εγ = the usable εα + εβ (straight: 0 and εα). */
  readonly axialContactRatio: number; readonly totalContactRatio: number;
  readonly sweep: { readonly samples: number; readonly minimumClearanceMM: number; readonly atDegrees: number; readonly interference: boolean; readonly converged: boolean; readonly coarseMinimumMM: number };
  readonly diagnostics: readonly GearDiagnostic[];
}

/**
 * A spur gear with a rack (R6a.5b): the same module and pressure angle (else MATE_INCOMPATIBLE); backlash, tip
 * clearances, the contact ratio by the formula and by the usable flanks; and the gear's exact outline swept against the
 * rack's through one tooth period (the rack taken long enough), the least clearance converged and refined, a crossing
 * measured by its depth — as for gear pairs (D55), cached and with the same verdict mode.
 */
export function checkSpurGearRack(gear: SpurGearSpec, rack: SpurRackSpec, options: SpurRackPairOptions = {}): SpurRackPairCheck {
  const key = JSON.stringify([gear, rack, options.centerDistanceMM ?? null, options.rackPhaseMM ?? 0, options.samples ?? 64, options.mode ?? 'report']);
  const kept = rackCache.get(key);
  if (kept) { rackCache.delete(key); rackCache.set(key, kept); return kept; }
  const out = rackCheck(gear, rack, options);
  rackCache.set(key, out); if (rackCache.size > 64) rackCache.delete(rackCache.keys().next().value!);
  return out;
}
const rackCache = new Map<string, SpurRackPairCheck>();

function rackCheck(gear: SpurGearSpec, rack: SpurRackSpec, options: SpurRackPairOptions): SpurRackPairCheck {
  const g = spurGearDimensions(gear), k = spurRackDimensions(rack);
  // (Helical: the rack as the z → ∞ gear of the pair — the same β, the opposite hand; checked in the transverse plane.)
  if (g.mn !== k.mn) throw new GearError('MATE_INCOMPATIBLE', `modules ${g.mn} and ${k.mn} mm do not mesh`);
  if (g.alphaN !== k.alphaN) throw new GearError('MATE_INCOMPATIBLE', 'pressure angles differ');
  if (g.beta !== -k.beta) throw new GearError('MATE_INCOMPATIBLE', g.beta === 0 || k.beta === 0 ? 'a straight rack does not mesh with a helical gear, nor a helical rack with a spur gear' : Math.abs(g.beta) !== Math.abs(k.beta) ? 'helix angles differ' : 'a rack of the same hand as the gear does not mesh (the rack carries the opposite hand, as the z → ∞ gear of an external pair)');
  const m = g.mn, alpha = g.alpha, x = gear.profileShiftCoefficient ?? 0, D0 = g.r + x * m, D = options.centerDistanceMM ?? D0;
  if (!(Number.isFinite(D) && D > g.rb)) throw new GearError('INVALID_INPUT', 'centerDistanceMM must be a number of mm beyond the base circle');
  const dd = D - D0, t = Math.tan(alpha), sa = Math.sin(alpha);
  // The gear's reference circle rolls on the rack's line D − r above its pitch line, where the rack's space is wider
  // by 2(D − r) tan α: backlash p − s_rack − s_gear + 2(D − r) tan α, with s_gear = 2r(ψ − inv α) (zero for a shifted
  // gear at r + x m: its 2 x m tan α thicker tooth fills that).
  const sg = 2 * g.r * (g.psi - inv(alpha)), backlash = k.pitchMM - sg - k.toothThicknessMM + 2 * (D - g.r) * t;
  const tips: [number, number] = [D - g.ra + k.dedendumMM, D - g.rf - k.addendumMM];
  // Along the line of action from the pitch point: the gear's side to where its tip meets it, the rack's side to the
  // rack's tip line, or to where the gear's usable flank starts.
  const A = Math.sqrt(g.ra ** 2 - g.rb ** 2) - g.r * sa, rackSide = (k.addendumMM - x * m - dd) / sa, lo = Math.sqrt(Math.max(0, g.rs ** 2 - g.rb ** 2));
  // (A filleted rack's straight flank ends at its fillet: the gear's tip meets it no deeper than that, R12b.1b.)
  const gearSide = k.rootFillet ? Math.min(A, (k.rootFillet.flankEndDepthMM + x * m + dd) / sa) : A;
  const pb = k.pitchMM * Math.cos(alpha), ideal = (A + rackSide) / pb, usable = (Math.max(0, gearSide) + Math.max(0, Math.min(rackSide, g.r * sa - lo))) / pb;
  const epsB = Math.min(gear.faceWidthMM, rack.faceWidthMM) * Math.abs(Math.sin(g.beta)) / (Math.PI * m);
  // The sweep: the gear about (0, D), a tooth pointing down at θ 0 and turned by θ; the rack's pitch line y 0, a gap
  // centred under the gear at θ 0 and the phase, travelling r θ.
  const P = exactProfile(gear, g), period = 2 * Math.PI / gear.teeth, N = Math.max(16, options.samples ?? 64), phase = options.rackPhaseMM ?? 0, verdict = options.mode === 'verdict';
  // (A crossing no deeper than rounding — the straight rack flank through the involute's sample points at zero
  // backlash — is contact, 0: interference is a crossing deeper than 1e-9 m.)
  const touch = 1e-9 * m, at = (theta: number) => { const d = rackClearance(P, theta, D, g.ra, g.r * theta + phase, k); return d < 0 && d >= -touch ? 0 : d; };
  const result = (least: number, tAt: number, converged: boolean, coarse: number, crossed: boolean, diagnostics: GearDiagnostic[]): SpurRackPairCheck => ({
    centerDistanceMM: D, nominalCenterDistanceMM: D0, workingPressureAngleDeg: alpha * 180 / Math.PI, backlashMM: backlash, tipClearancesMM: tips, idealContactRatio: ideal, usableContactRatio: usable, axialContactRatio: epsB, totalContactRatio: usable + epsB,
    sweep: { samples: N, minimumClearanceMM: least, atDegrees: tAt * 180 / Math.PI, interference: crossed, converged, coarseMinimumMM: coarse }, diagnostics });
  if (verdict) {
    let least = Infinity, tAt = 0;
    for (let i = 0; i < N; i++) { const th = period * i / N, d = at(th); if (d < least) { least = d; tAt = th; } if (d < 0) break; }
    const crossed = least < 0;
    return result(crossed ? -0 : least, tAt, false, least, crossed, crossed ? [{ code: 'SELF_INTERSECTION', severity: 'error', message: `the gear and rack teeth cross at ${(tAt * 180 / Math.PI).toFixed(4)}° of the gear (the depth: a report)` }] : []);
  }
  let coarse = { d: Infinity, t: 0 }, fine = { d: Infinity, t: 0 };
  for (let i = 0; i < N; i++) { const th = period * i / N, d = at(th); if (d < coarse.d) coarse = { d, t: th }; }
  for (let i = 0; i < 2 * N; i++) { const th = period * i / (2 * N), d = at(th); if (d < fine.d) fine = { d, t: th }; }
  const seed = fine.d < coarse.d ? fine : coarse, G = 0.618033988749895;
  let lo2 = seed.t - period / N, hi2 = seed.t + period / N, x1 = hi2 - G * (hi2 - lo2), x2 = lo2 + G * (hi2 - lo2), f1 = at(x1), f2 = at(x2);
  for (let it = 0; it < 60 && hi2 - lo2 > 1e-9; it++) { if (f1 < f2) { hi2 = x2; x2 = x1; f2 = f1; x1 = hi2 - G * (hi2 - lo2); f1 = at(x1); } else { lo2 = x1; x1 = x2; f1 = f2; x2 = lo2 + G * (hi2 - lo2); f2 = at(x2); } }
  const refined = Math.min(seed.d, f1, f2), tAt = f1 < f2 ? x1 : x2, converged = Math.abs(coarse.d - fine.d) <= Math.max(1e-6 * m, 0.02 * Math.abs(refined));
  const diagnostics: GearDiagnostic[] = [];
  if (refined < 0) diagnostics.push({ code: 'SELF_INTERSECTION', severity: 'error', message: `the gear and rack teeth cross by ${(-refined).toFixed(6)} mm at ${(tAt * 180 / Math.PI).toFixed(4)}° of the gear` });
  if (!converged) diagnostics.push({ code: 'INVALID_INPUT', severity: 'warning', message: `the sweep did not settle (${N} samples: ${coarse.d.toExponential(3)}, ${2 * N}: ${fine.d.toExponential(3)} mm): more samples are needed` });
  if (usable + 1e-12 < ideal) diagnostics.push({ code: 'ROOT_TRANSITION_UNVALIDATED', severity: 'warning', message: `the usable flanks give a contact ratio of ${usable.toFixed(4)}, below the ideal ${ideal.toFixed(4)}` });
  return result(refined, tAt, converged, coarse.d, refined < 0, diagnostics);
}

/**
 * The rack's outline near the gear as one run (x decreasing, its material on the left: below), the teeth whose gaps lie
 * within `reach` of x 0, gaps centred at `shift` + k πm.
 */
function rackRun(k: ReturnType<typeof spurRackDimensions>, shift: number, reach: number): Float64Array {
  const p = k.pitchMM, t = Math.tan(k.alpha), ha = k.addendumMM, hf = k.dedendumMM, s = k.s, pts: number[] = [];
  const first = Math.ceil((-reach - shift) / p) - 1, last = Math.floor((reach - shift) / p) + 1;
  const f = k.fillet;
  for (let j = last; j >= first; j--) {
    // The tooth between gap j − 1 and gap j, centred at shift + (j − ½)p: right flank down to left, x decreasing (a
    // filleted root's fillets at 12 points each, the ellipse itself).
    const c = shift + (j - 0.5) * p;
    if (f) {
      const cR = c + s / 2 + hf * t + f.dx, cy = -hf + f.b;
      for (let i = 0; i <= 12; i++) { const th = 1.5 * Math.PI + (f.thetaT - 1.5 * Math.PI) * i / 12; pts.push(cR + f.a * Math.cos(th), cy + f.b * Math.sin(th)); }
      pts.push(c + s / 2 - ha * t, ha, c - s / 2 + ha * t, ha);
      for (let i = 12; i >= 0; i--) { const th = 1.5 * Math.PI + (f.thetaT - 1.5 * Math.PI) * i / 12; pts.push(2 * c - cR - f.a * Math.cos(th), cy + f.b * Math.sin(th)); }
      continue;
    }
    pts.push(c + s / 2 + hf * t, -hf, c + s / 2 - ha * t, ha, c - s / 2 + ha * t, ha, c - s / 2 - hf * t, -hf);
  }
  return Float64Array.from(pts);
}

/** The least distance between the gear's outline (about (0, D), turned θ from a tooth pointing down) and the rack's; negative by the depth when they cross. */
function rackClearance(P: { tooth: Float64Array; z: number }, theta: number, D: number, ra: number, shift: number, k: ReturnType<typeof spurRackDimensions>): number {
  const A = teethNear(P, -Math.PI / 2 + theta, 0, D, -Math.PI / 2), run = rackRun(k, shift, ra + 2 * k.pitchMM);
  // The gear's segments that reach down to the rack's tip line (and a little); the rack's within the gear's tip circle.
  const yTop = k.addendumMM + 1, sa = belowSegments(A, yTop), sb = nearSegments([run], 0, D, ra + 1);
  let best = Infinity, crossed = false;
  for (let i = 0; i < sa.length; i += 4) {
    const ax = sa[i], ay = sa[i + 1], bx = sa[i + 2], by = sa[i + 3];
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    for (let j = 0; j < sb.length; j += 4) {
      const cx = sb[j], cy = sb[j + 1], dx = sb[j + 2], dy = sb[j + 3];
      const gx = Math.max(0, Math.min(cx, dx) - x1, x0 - Math.max(cx, dx)), gy = Math.max(0, Math.min(cy, dy) - y1, y0 - Math.max(cy, dy));
      if (gx * gx + gy * gy > best * best) continue;
      if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) { crossed = true; best = 0; break; }
      best = Math.min(best, segmentDistance(ax, ay, bx, by, cx, cy, dx, dy));
    }
    // (Crossed: the depth below says by how much; no more segments are needed.)
    if (crossed) break;
  }
  if (!crossed) return best;
  // The depth: the deepest point of the gear below the rack's outline (under its tip line), or of the rack inside the gear (within its tip circle).
  return -Math.max(deepest(sa, sb, 0, 0, 0, k.addendumMM), deepest(sb, sa, 0, D, ra, 0));
}
/** The segments of the runs with an end below y. */
function belowSegments(runs: Float64Array[], y: number): Float64Array {
  const out: number[] = [];
  for (const q of runs) for (let i = 0; i + 3 < q.length; i += 2) if (q[i + 1] <= y || q[i + 3] <= y) out.push(q[i], q[i + 1], q[i + 2], q[i + 3]);
  return Float64Array.from(out);
}
/**
 * The largest distance of a point of X's segments on the material side (left) of Y's nearest segment; points
 * pre-filtered by a circle (ra > 0: within ra of (cx, cy)) or a line (ra 0: below yMax).
 */
function deepest(X: Float64Array, Y: Float64Array, cx: number, cy: number, ra: number, yMax: number): number {
  let deep = 0;
  for (let i = 0; i < X.length; i += 2) {
    const px = X[i], py = X[i + 1];
    if (ra > 0 ? (px - cx) * (px - cx) + (py - cy) * (py - cy) >= ra * ra : py >= yMax) continue;
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

/** A rack as it stands: its pitch line from `origin` along `angle` (radians), teeth to its left, faces from `from` through b. */
export interface PlacedSpurRack { readonly spec: SpurRackSpec; readonly origin: readonly [number, number]; readonly angle: number; readonly from: number }
export interface PlacedSpurRackCheck extends SpurRackPairCheck { readonly rackPhaseMM: number; readonly faceOverlapMM: number }

/**
 * The gear-and-rack checks as placed (R6a.5b, D58): the gear axis's distance from the pitch line, and the phase — where
 * the rack's gaps stand against the gear's teeth, modulo the pitch — from the gear's turn; parallel (both along +Z)
 * and the faces overlapping, else MATE_INCOMPATIBLE, as is a rack whose teeth face away from the gear.
 */
export function checkPlacedSpurRack(gear: { readonly spec: SpurGearSpec; readonly center: readonly [number, number]; readonly from: number; readonly rotation: number }, rack: PlacedSpurRack, options: Omit<SpurRackPairOptions, 'centerDistanceMM' | 'rackPhaseMM'> = {}): PlacedSpurRackCheck {
  const overlap = Math.min(gear.from + gear.spec.faceWidthMM, rack.from + rack.spec.faceWidthMM) - Math.max(gear.from, rack.from);
  if (!(overlap > 0)) throw new GearError('MATE_INCOMPATIBLE', `the faces do not overlap along the axis (${overlap.toFixed(6)} mm)`);
  const ex = Math.cos(rack.angle), ey = Math.sin(rack.angle), qx = gear.center[0] - rack.origin[0], qy = gear.center[1] - rack.origin[1];
  const u = qx * ex + qy * ey, D = -qx * ey + qy * ex;
  if (!(D > 0)) throw new GearError('MATE_INCOMPATIBLE', 'the rack\'s teeth face away from the gear');
  // (Helical: both taken at the same height, where their faces begin to overlap — the gear's section turned along its
  // helix, the rack's slid along its shear.)
  const g = spurGearDimensions(gear.spec), k = spurRackDimensions(rack.spec), r = g.r, p = Math.PI * g.mt, zRef = Math.max(gear.from, rack.from);
  const theta = gear.rotation + (zRef - gear.from) * Math.tan(g.beta) / r - (rack.angle - Math.PI / 2);
  let phase = ((-u + k.shear * (zRef - rack.from) - r * theta) % p + p) % p; if (phase < 1e-9 * p || p - phase < 1e-9 * p) phase = 0;
  const check = checkSpurGearRack(gear.spec, rack.spec, { ...options, centerDistanceMM: D, rackPhaseMM: phase });
  return { ...check, rackPhaseMM: phase, faceOverlapMM: overlap };
}
