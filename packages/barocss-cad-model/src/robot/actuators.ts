// Actuator sizing (RD3, O22): a motor and a reducer for each turning joint, from what a move asks of it.
// The joint's torque τ(t), rate q̇(t) and acceleration q̈(t) come from RD2 (RNEA along the profile); the cycle is the
// move out, a dwell at the end, the move back and a dwell at the start, repeated. For a motor m on a reducer of ratio
// N and efficiency η:
//   motor speed      n_m = N |q̇| · 60/2π                                   (rpm)
//   motor torque     τ_m = τ/(N η) + (J_m + J_in) N q̈ + T_f sgn q̇        (N·m; η divides in every quadrant: conservative)
//                    with the rotor's and the reducer input's inertia, and the motor's friction T_f = I_0 k_t (q̇'s sign:
//                    the move's, so at its ends too)
// The checks, each against a value with its source (a product page read, or a flagged estimate):
//   motor   RMS τ_m over the cycle ≤ the nominal (max. continuous) torque;
//           |τ_m| ≤ the torque–speed line at the nominal voltage, (n_0 − n_m)/(Δn/ΔM), at every instant;
//           n_m ≤ the max. speed;  the load's inertia M_jj(q)/N² ≤ ratio × (J_m + J_in)
//   reducer |τ| ≤ the limit for repeated peak torque;  n_in ≤ the max. input speed;
//           T_av = (∫ n |τ|³ dt / ∫ n dt)^⅓ ≤ the limit for average torque (the cube mean weighted by speed);
//           n_av = ∫ n dt / T_cycle ≤ the average input speed;
//           life L10 = L_n (T_r / T_av)³ (n_r / n_av) — the rated torque T_r at the rated input speed n_r for L_n hours.
// Integrals by Simpson's rule over each segment of the profile (256 samples a segment, where the motion is one
// polynomial), the dwells exactly; the chosen pair's peaks refined by golden section and checked again.
// Rigid and decoupled: an actuator's own mass is not added to the links (the parts as modelled), so each joint is
// sized alone. A slide is not sized (no linear actuator data yet).
import type { JointTree } from './joints';
import { coordinates, massMatrix, moveMotion, moveState, rnea, STANDARD_GRAVITY, type LinkBody, type MoveLimits, type MoveMotion } from './dynamics';
import type { V3 } from './inertia';
import type { ProfileKind, Segment } from './profile';
import { refusal } from '../engine/refusal';

/** Where a value comes from: a product page read in the browser (its URL, the date read, the page's own label), a
 * value derived from sourced ones (how), or an estimate (why, and what would replace it). */
export type Source = { page: string; read: string; label: string } | { derived: string } | { estimate: string };
export interface Value { v: number; unit: string; src: Source }

/** Units as the pages give them, to SI (speeds stay in rpm, as every page gives them). */
const UNITS: Record<string, number> = { V: 1, rpm: 1, Nm: 1, 'N·m': 1, mNm: 1e-3, Ncm: 1e-2, A: 1, mA: 1e-3, 'kg·m²': 1, 'gcm²': 1e-7, 'kgcm²': 1e-4, 'mNm/A': 1e-3, 'Nm/A': 1, 'rpm/mNm': 1e3, 'rpm/Nm': 1, kg: 1, g: 1e-3, '%': 1e-2, h: 1, '': 1 };
export function si(x: Value): number {
  const f = UNITS[x.unit];
  if (f === undefined) throw refusal('ACTUATOR_INPUT', `unit "${x.unit}" is not known (${Object.keys(UNITS).filter(Boolean).join(', ')})`);
  return x.v * f;
}
export const isEstimate = (x: Value) => 'estimate' in x.src;

export interface Motor {
  id: string; name: string; maker: string; note?: string;
  nominalVoltage: Value; noLoadSpeed: Value; noLoadCurrent: Value; nominalTorque: Value; stallTorque: Value;
  speedTorqueGradient: Value; torqueConstant: Value; rotorInertia: Value; maxSpeed: Value; mass: Value;
}
export interface Reducer {
  id: string; name: string; maker: string; note?: string;
  ratio: Value; ratedTorque: Value; averageTorqueLimit: Value; repeatedPeakTorque: Value; momentaryPeakTorque: Value;
  averageInputSpeed: Value; maxInputSpeed: Value; inputInertia: Value; efficiency: Value; ratedInputSpeed: Value; ratedLife: Value; mass: Value;
}
export const MOTOR_FIELDS = ['nominalVoltage', 'noLoadSpeed', 'noLoadCurrent', 'nominalTorque', 'stallTorque', 'speedTorqueGradient', 'torqueConstant', 'rotorInertia', 'maxSpeed', 'mass'] as const;
export const REDUCER_FIELDS = ['ratio', 'ratedTorque', 'averageTorqueLimit', 'repeatedPeakTorque', 'momentaryPeakTorque', 'averageInputSpeed', 'maxInputSpeed', 'inputInertia', 'efficiency', 'ratedInputSpeed', 'ratedLife', 'mass'] as const;

// ——— The catalogue: product pages read 2026-10-20 in the browser (read only, no sign-in, nothing downloaded,
// non-essential cookies declined). Values are the pages' facts under the pages' own labels.
const READ = '2026-10-20';
const MAXON_608131 = 'https://www.maxongroup.com/maxon/view/product/motor/ecmotor/ecflat/ecflat45/608131';
const mx = (v: number, unit: string, label: string): Value => ({ v, unit, src: { page: MAXON_608131, read: READ, label } });
export const MOTORS: readonly Motor[] = [{
  id: 'maxon-608131', name: 'EC 45 flat Ø43.5 mm, brushless, 60 W, with Hall sensors and cable', maker: 'maxon', note: 'The page marks it NRND (Not Recommended for New Designs).',
  nominalVoltage: mx(18, 'V', 'Nominal voltage'), noLoadSpeed: mx(5740, 'rpm', 'No load speed'), noLoadCurrent: mx(277, 'mA', 'No load current'),
  nominalTorque: mx(134, 'mNm', 'Nominal torque (max. continuous torque)'), stallTorque: mx(1190, 'mNm', 'Stall torque'),
  speedTorqueGradient: mx(4.91, 'rpm/mNm', 'Speed / torque gradient'), torqueConstant: mx(29.5, 'mNm/A', 'Torque constant'),
  rotorInertia: mx(135, 'gcm²', 'Rotor inertia'), maxSpeed: mx(10000, 'rpm', 'Max. speed'), mass: mx(113, 'g', 'Weight'),
}];

// Harmonic Drive CSG-2A-LW component sets: the rated torque (L10), the three torque limits, the average input speed
// and the mass from each product page; the rest is not on the pages (the catalogue is a PDF, which needs the owner's
// OK to open), so it is estimated and flagged: what the life formula rates at, the maximum input speed, the wave
// generator's inertia and the efficiency.
const HD = 'https://www.harmonicdrive.net/products/component-sets/cup-type/csg-2a-lw/';
const HD_EST = 'not on the product page; the CSG catalogue (a PDF) needs the owner\'s OK to open — ';
/** size: [max input speed rpm, wave generator inertia ×10⁻⁴ kg·m²] (estimates, recalled catalogue magnitudes). */
const HD_SIZE: Record<number, [number, number]> = { 14: [8500, 0.033], 17: [7300, 0.079], 20: [6500, 0.193], 25: [5600, 0.413], 32: [4800, 1.69] };
/** [size, ratio, type, rated L10, average, repeated peak, momentary peak (N·m), mass (kg)] as each page gives them. */
const HD_PAGES: readonly [number, number, string, number, number, number, number, number][] = [
  [14, 50, 'r', 7, 9, 23, 46, 0.06], [14, 80, 'r', 10, 14, 30, 61, 0.06], [14, 100, 'r', 10, 14, 36, 70, 0.06],
  [17, 50, 'r', 21, 34, 44, 91, 0.1], [17, 80, 'r', 29, 35, 56, 113, 0.1], [17, 100, 'r', 31, 51, 70, 125, 0.1], [17, 120, 'r', 31, 51, 70, 112, 0.1],
  [20, 50, 'gr', 33, 44, 73, 127, 0.14], [20, 80, 'gr', 44, 61, 96, 155, 0.14], [20, 100, 'gr', 52, 64, 107, 155, 0.14], [20, 120, 'gr', 52, 64, 113, 155, 0.14], [20, 160, 'gr', 52, 64, 120, 155, 0.14],
  [25, 50, 'gr', 51, 72, 127, 242, 0.24], [25, 100, 'gr', 87, 140, 204, 342, 0.24], [25, 160, 'gr', 87, 140, 229, 342, 0.24],
  [32, 50, 'gr', 99, 140, 281, 497, 0.54], [32, 100, 'gr', 178, 281, 433, 535, 0.54], [32, 160, 'gr', 178, 281, 484, 535, 0.54],
];
export const REDUCERS: readonly Reducer[] = HD_PAGES.map(([size, ratio, type, rated, avg, rep, mom, kg]) => {
  const model = `CSG-${size}-${ratio}-2A-${type.toUpperCase()}-BB-LW`, url = HD + model.toLowerCase(), p = (v: number, unit: string, label: string): Value => ({ v, unit, src: { page: url, read: READ, label } });
  const [nMax, jWg] = HD_SIZE[size];
  return {
    id: `hd-${model.toLowerCase()}`, name: model, maker: 'Harmonic Drive',
    ratio: p(ratio, '', 'Ratio'), ratedTorque: p(rated, 'Nm', 'Rated Torque L10'), averageTorqueLimit: p(avg, 'Nm', 'Limit for Average Torque'),
    repeatedPeakTorque: p(rep, 'Nm', 'Limit for Repeated Peak Torque'), momentaryPeakTorque: p(mom, 'Nm', 'Limit for Momentary Peak Torque'),
    averageInputSpeed: p(3500, 'rpm', 'Ave. Input Speed'), mass: p(kg, 'kg', 'Mass'),
    maxInputSpeed: { v: nMax, unit: 'rpm', src: { estimate: HD_EST + 'the grease-lubricated maximum input speed for the size, as recalled' } },
    inputInertia: { v: jWg, unit: 'kgcm²', src: { estimate: HD_EST + 'the wave generator\'s moment of inertia for the size, as recalled (×10⁻⁴ kg·m² = kg·cm²)' } },
    efficiency: { v: 70, unit: '%', src: { estimate: HD_EST + 'it varies with speed, load and temperature; 70 % taken as a typical value' } },
    ratedInputSpeed: { v: 2000, unit: 'rpm', src: { estimate: HD_EST + 'the input speed the rated torque is given at, as recalled' } },
    ratedLife: { v: 10000, unit: 'h', src: { estimate: HD_EST + 'the L10 life the rated torque is given for (CSG), as recalled' } },
  };
});

/** What the published worked examples would show; pending until the owner allows the documents (downloads). */
export const PENDING_WORKED_EXAMPLES = [
  'Harmonic Drive CSG-2A / CSF component-set catalogue (PDF): its gear selection worked example (cube-mean average torque, average input speed, life) — to be reproduced with these formulas',
  'maxon motor catalogue (PDF): the motor selection example (operating point, RMS torque, the speed–torque line) — to be reproduced with these formulas',
];

export interface SizeOptions {
  dwell?: number; /** s, at each end */
  life?: number; /** h, required L10 life (absent: reported, not checked) */
  inertiaRatio?: number; /** the load's inertia over the drive's, at most (default 10, a rule of thumb) */
  motors?: readonly Motor[]; reducers?: readonly Reducer[];
  g?: V3;
  /** rad/s², a stated stop event (an emergency stop): every moving joint decelerating at it from the cycle's fastest
   * instant; its output torque is checked against the reducer's momentary peak torque (absent: not checked, said so). */
  estop?: number;
}
export const DEFAULT_INERTIA_RATIO = 10;
/** The model in one line, as the tool states it. */
export const SIZING_MODEL = 'rigid; τ_m = τ/(N η) + (J_m + J_in) N q̈ + T_f sgn q̇, η dividing in every quadrant (conservative); T_f = no-load current × torque constant (from the page\'s values); the torque–speed line (n_0 − n)/(Δn/ΔM) at the nominal voltage; T_av = (∫ n|τ|³ dt / ∫ n dt)^⅓; L10 = L_n (T_r/T_av)³ (n_r/n_av); the momentary peak torque checked only for a stated stop (estop: every moving joint decelerating at it from the cycle\'s fastest instant); the actuators\' own mass added to the links only when sized coupled (each pair a point mass at its joint, on the joint\'s parent link, until the choices settle)';
export interface Check { name: string; value: number; limit: number; unit: string; ok: boolean; /** limit − value over the limit */ margin: number; limitSource: 'page' | 'derived' | 'estimate' | 'rule' }
export interface JointSizing {
  key: string;
  choice: { motor: string; reducer: string; ratio: number; massKg: number } | null;
  checks: Check[];
  candidates: number; feasible: number; rejected: Record<string, number>;
  estimates: string[]; sources: { field: string; src: Source }[];
}
export interface Sizing { kind: ProfileKind; moveS: number; cycleS: number; joints: JointSizing[]; skipped: { key: string; why: string }[]; sampling: string; pending: string[] }

const SAMPLES = 256, RPM = 60 / (2 * Math.PI), GOLD = 0.618033988749895;
/** One move's samples: per segment the times, and per joint τ, q̇, q̈ at each; Simpson weights folded in. */
interface Track { motion: MoveMotion; segs: { seg: Segment; h: number; t: number[]; tau: Record<string, number>[]; qd: Record<string, number>[]; qdd: Record<string, number>[] }[] }
function track(tree: JointTree, bodies: ReadonlyMap<string, LinkBody>, motion: MoveMotion, g: V3): Track {
  const segs: Track['segs'] = [];
  for (const seg of motion.profile?.segments ?? []) {
    const h = (seg.t1 - seg.t0) / SAMPLES, t: number[] = [], tau: Record<string, number>[] = [], qd: Record<string, number>[] = [], qdd: Record<string, number>[] = [];
    for (let i = 0; i <= SAMPLES; i++) { const ti = seg.t0 + i * h, x = moveState(motion, seg, ti); t.push(ti); tau.push(rnea(tree, bodies, x.q, x.qd, x.qdd, g)); qd.push(x.qd); qdd.push(x.qdd); }
    segs.push({ seg, h, t, tau, qd, qdd });
  }
  return { motion, segs };
}
const simpson = (i: number, n: number) => (i === 0 || i === n ? 1 : i % 2 ? 4 : 2);

/** A pair's constants in SI (torques N·m, speeds rpm, inertia kg·m²). */
interface Drive { N: number; eta: number; J: number; Tf: number; n0: number; grad: number; Tcont: number; nMax: number; Jm: number; rep: number; avg: number; navMax: number; ninMax: number; Tr: number; nr: number; Ln: number }
function drive(m: Motor, r: Reducer): Drive {
  return { N: si(r.ratio), eta: si(r.efficiency), J: si(m.rotorInertia) + si(r.inputInertia), Tf: si(m.noLoadCurrent) * si(m.torqueConstant), n0: si(m.noLoadSpeed), grad: si(m.speedTorqueGradient), Tcont: si(m.nominalTorque), nMax: si(m.maxSpeed),
    Jm: si(m.rotorInertia) + si(r.inputInertia), rep: si(r.repeatedPeakTorque), avg: si(r.averageTorqueLimit), navMax: si(r.averageInputSpeed), ninMax: si(r.maxInputSpeed), Tr: si(r.ratedTorque), nr: si(r.ratedInputSpeed), Ln: si(r.ratedLife) };
}
/** τ_m at one instant. */
// (Friction against the move's direction: q̇ keeps the sign of Δq through a move from rest to rest, its one-sided
// limit where it is 0 at the ends.)
const motorTorque = (d: Drive, tau: number, dir: number, qdd: number) => tau / (d.N * d.eta) + d.J * d.N * qdd + d.Tf * dir;
const envelope = (d: Drive, nm: number) => Math.max(0, (d.n0 - nm) / d.grad);

interface Totals { sq: number; cube: number; speed: number; peakTm: number; minEnv: number; peakTau: number; nmMax: number }
/** The integrals and extremes over the sampled moves, plus the dwells' holding torques. */
function totals(d: Drive, key: string, tracks: readonly Track[], hold: readonly number[], dwell: number): Totals {
  let sq = 0, cube = 0, speed = 0, peakTm = 0, minEnv = Infinity, peakTau = 0, nmMax = 0;
  for (const tr of tracks) for (const s of tr.segs) {
    const dir = Math.sign(tr.motion.dq[key]);
    let a = 0, c = 0, w = 0;
    for (let i = 0; i <= SAMPLES; i++) {
      const tau = s.tau[i][key], qd = s.qd[i][key], tm = motorTorque(d, tau, dir, s.qdd[i][key]), nm = d.N * Math.abs(qd) * RPM, k = simpson(i, SAMPLES);
      a += k * tm * tm; c += k * nm * Math.abs(tau) ** 3; w += k * nm;
      peakTm = Math.max(peakTm, Math.abs(tm)); minEnv = Math.min(minEnv, envelope(d, nm) - Math.abs(tm)); peakTau = Math.max(peakTau, Math.abs(tau)); nmMax = Math.max(nmMax, nm);
    }
    sq += a * s.h / 3; cube += c * s.h / 3; speed += w * s.h / 3;
  }
  for (const tau of hold) { const tm = tau / (d.N * d.eta); sq += dwell * tm * tm; peakTm = Math.max(peakTm, Math.abs(tm)); minEnv = Math.min(minEnv, envelope(d, 0) - Math.abs(tm)); peakTau = Math.max(peakTau, Math.abs(tau)); }
  return { sq, cube, speed, peakTm, minEnv, peakTau, nmMax };
}

/** The measure f maximized at one instant: 0 |τ_m|, 1 |τ_m| over the torque–speed line, 2 |τ| at the output. */
function measure(f: number, d: Drive, tau: number, qd: number, qdd: number, dir: number): number {
  const tm = Math.abs(motorTorque(d, tau, dir, qdd));
  return f === 0 ? tm : f === 1 ? tm - envelope(d, d.N * Math.abs(qd) * RPM) : Math.abs(tau);
}
interface Probe { tree: JointTree; bodies: ReadonlyMap<string, LinkBody>; g: V3; d: Drive; key: string }
/** The measure f at time t of a segment, by the RNEA there. */
function probeAt(p: Probe, f: number, motion: MoveMotion, seg: Segment, t: number): number {
  const x = moveState(motion, seg, t);
  return measure(f, p.d, rnea(p.tree, p.bodies, x.q, x.qd, x.qdd, p.g)[p.key], x.qd[p.key], x.qdd[p.key], Math.sign(motion.dq[p.key]));
}
/** Refines the chosen pair's extremes by golden section around each segment's worst sample (RNEA at each probe). */
function refine(p: Probe, tracks: readonly Track[], t0: Totals): Totals {
  const out = { ...t0 }, key = p.key;
  for (const tr of tracks) for (const s of tr.segs) for (let f = 0; f < 3; f++) {
    // (n_m's largest is at a segment end, where q̈ changes sign or is 0: the samples have it.)
    let best = 0, bestV = -Infinity;
    for (let i = 0; i <= SAMPLES; i++) { const v = measure(f, p.d, s.tau[i][key], s.qd[i][key], s.qdd[i][key], Math.sign(tr.motion.dq[key])); if (v > bestV) { bestV = v; best = i; } }
    let lo = s.t[Math.max(0, best - 1)], hi = s.t[Math.min(SAMPLES, best + 1)];
    for (let it = 0; it < 40; it++) { const m1 = hi - (hi - lo) * GOLD, m2 = lo + (hi - lo) * GOLD; if (probeAt(p, f, tr.motion, s.seg, m1) > probeAt(p, f, tr.motion, s.seg, m2)) hi = m2; else lo = m1; }
    const v = Math.max(bestV, probeAt(p, f, tr.motion, s.seg, (lo + hi) / 2));
    if (f === 0) out.peakTm = Math.max(out.peakTm, v); else if (f === 1) out.minEnv = Math.min(out.minEnv, -v); else out.peakTau = Math.max(out.peakTau, v);
  }
  return out;
}

/** A stop's output torque at a joint: from the instant its speed is greatest (over the samples), every moving joint
 * decelerating at `a` (RNEA there); its magnitude. */
function stopTorque(tree: JointTree, bodies: ReadonlyMap<string, LinkBody>, tracks: readonly Track[], key: string, a: number, g: V3): number {
  let best: { tr: Track; s: Track['segs'][number]; i: number } | null = null, fast = -1;
  for (const tr of tracks) for (const s of tr.segs) for (let i = 0; i <= SAMPLES; i++) { const v = Math.abs(s.qd[i][key]); if (v > fast) { fast = v; best = { tr, s, i }; } }
  if (!best) return 0;
  const x = moveState(best.tr.motion, best.s.seg, best.s.t[best.i]), qdd: Record<string, number> = {};
  for (const k of Object.keys(x.qd)) qdd[k] = -Math.sign(x.qd[k]) * a;
  return Math.abs(rnea(tree, bodies, x.q, x.qd, qdd, g)[key]);
}

const kindOf = (x: Value): Check['limitSource'] => ('page' in x.src ? 'page' : 'derived' in x.src ? 'derived' : 'estimate');
function checks(d: Drive, m: Motor, r: Reducer, T: Totals, cycle: number, jLoad: number, opts: SizeOptions, stop: number | null = null): Check[] {
  const c = (name: string, value: number, limit: number, unit: string, src: Check['limitSource'], atMost = true): Check => ({ name, value, limit, unit, ok: atMost ? value <= limit : value >= limit, margin: limit ? (atMost ? limit - value : value - limit) / limit : 0, limitSource: src });
  const rms = Math.sqrt(T.sq / cycle), Tav = T.speed > 0 ? Math.cbrt(T.cube / T.speed) : 0, nav = T.speed / cycle, life = Tav > 0 && nav > 0 ? d.Ln * (d.Tr / Tav) ** 3 * (d.nr / nav) : Infinity;
  const ratio = opts.inertiaRatio ?? DEFAULT_INERTIA_RATIO, both = (a: Value, b: Value) => (isEstimate(a) || isEstimate(b) ? 'estimate' : 'page') as Check['limitSource'];
  const out = [
    c('motor RMS torque', rms, d.Tcont, 'N·m', kindOf(m.nominalTorque)),
    // (The envelope as a margin: |τ_m| − line(n_m) ≤ 0 at every instant.)
    c('motor torque–speed line', -T.minEnv, 0, 'N·m over the line', kindOf(m.speedTorqueGradient)),
    c('motor speed', T.nmMax, d.nMax, 'rpm', kindOf(m.maxSpeed)),
    c('inertia ratio', jLoad / (d.N * d.N) / d.Jm, ratio, '', 'rule'),
    c('reducer repeated peak torque', T.peakTau, d.rep, 'N·m', kindOf(r.repeatedPeakTorque)),
    c('reducer input speed', T.nmMax, d.ninMax, 'rpm', kindOf(r.maxInputSpeed)),
    c('reducer average torque', Tav, d.avg, 'N·m', kindOf(r.averageTorqueLimit)),
    c('reducer average input speed', nav, d.navMax, 'rpm', kindOf(r.averageInputSpeed)),
  ];
  out[1].margin = d.Tcont ? T.minEnv / d.Tcont : 0;
  const lifeCheck = c('reducer life L10', life, opts.life ?? 0, 'h', both(r.ratedLife, r.ratedInputSpeed), false);
  if (opts.life === undefined) { lifeCheck.ok = true; lifeCheck.margin = Infinity; }
  out.push(lifeCheck);
  if (stop !== null) out.push(c('reducer momentary peak torque', stop, si(r.momentaryPeakTorque), 'N·m', kindOf(r.momentaryPeakTorque)));
  return out;
}

/**
 * Sizes each turning joint of a move q0 → q1 (and back, with dwells): every motor × reducer pair is checked over the
 * sampled cycle, the feasible ones ranked by mass (then by their least margin, larger first); the lightest is refined
 * and checked again (if its refined peaks fail, the next is taken).
 */
export function sizeActuators(tree: JointTree, bodies: ReadonlyMap<string, LinkBody>, q0: Readonly<Record<string, number>>, q1: Readonly<Record<string, number>>, kind: ProfileKind, limits: (key: string) => MoveLimits, opts: SizeOptions = {}): Sizing {
  const g = opts.g ?? [0, 0, -STANDARD_GRAVITY], dwell = opts.dwell ?? 0, motors = opts.motors ?? MOTORS, reducers = opts.reducers ?? REDUCERS;
  if (!(dwell >= 0) || !Number.isFinite(dwell)) throw refusal('ACTUATOR_INPUT', 'the dwell is a time of 0 s or more');
  const out = moveMotion(tree, q0, q1, kind, limits), back = moveMotion(tree, q1, q0, kind, limits), tracks = [track(tree, bodies, out, g), track(tree, bodies, back, g)];
  const moveS = out.profile?.duration ?? 0, cycleS = 2 * moveS + 2 * dwell;
  const zero = Object.fromEntries(out.keys.map(k => [k, 0])), hold = [rnea(tree, bodies, q1, zero, zero, g), rnea(tree, bodies, q0, zero, zero, g)];
  // (The load's inertia at each joint: the largest diagonal of M over the segment ends of both moves.)
  const poses: Record<string, number>[] = [{ ...zero, ...q0 }, { ...zero, ...q1 }];
  for (const tr of tracks) for (const s of tr.segs) poses.push(moveState(tr.motion, s.seg, s.seg.t1).q);
  const Ms = poses.map(q => massMatrix(tree, bodies, q));
  const joints: JointSizing[] = [], skipped: Sizing['skipped'] = [];
  for (const key of coordinates(tree)) {
    const j = tree.joints.find(x => x.key === key)!;
    if (j.type === 'prismatic') { skipped.push({ key, why: 'a slide: no linear actuator data yet' }); continue; }
    if (!out.dq[key] && Math.max(...hold.map(h => Math.abs(h[key]))) === 0) { skipped.push({ key, why: 'neither moves nor holds a load in this cycle' }); continue; }
    const jLoad = Math.max(...Ms.map(({ keys, M }) => { const i = keys.indexOf(key); return M[i][i]; })), stop = opts.estop === undefined ? null : stopTorque(tree, bodies, tracks, key, opts.estop, g);
    const ranked: { m: Motor; r: Reducer; d: Drive; c: Check[]; mass: number; least: number }[] = [], rejected: Record<string, number> = {};
    for (const m of motors) for (const r of reducers) {
      const d = drive(m, r), c = checks(d, m, r, totals(d, key, tracks, hold.map(h => h[key]), dwell), cycleS || 1, jLoad, opts, stop), fail = c.find(x => !x.ok);
      if (fail) { rejected[fail.name] = (rejected[fail.name] ?? 0) + 1; continue; }
      ranked.push({ m, r, d, c, mass: si(m.mass) + si(r.mass), least: Math.min(...c.map(x => x.margin)) });
    }
    ranked.sort((a, b) => a.mass - b.mass || b.least - a.least);
    let pick: (typeof ranked)[number] | null = null;
    for (const cand of ranked) {
      const T = refine({ tree, bodies, g, d: cand.d, key }, tracks, totals(cand.d, key, tracks, hold.map(h => h[key]), dwell)), c = checks(cand.d, cand.m, cand.r, T, cycleS || 1, jLoad, opts, stop);
      if (c.every(x => x.ok)) { pick = { ...cand, c }; break; }
      const fail = c.find(x => !x.ok)!; rejected[`${fail.name} (refined)`] = (rejected[`${fail.name} (refined)`] ?? 0) + 1;
    }
    const sources = pick ? [...MOTOR_FIELDS.map(f => ({ field: `motor.${f}`, src: pick!.m[f].src })), ...REDUCER_FIELDS.map(f => ({ field: `reducer.${f}`, src: pick!.r[f].src }))] : [];
    joints.push({
      key, choice: pick ? { motor: pick.m.id, reducer: pick.r.id, ratio: si(pick.r.ratio), massKg: pick.mass } : null, checks: pick?.c ?? [],
      candidates: motors.length * reducers.length, feasible: ranked.length, rejected,
      estimates: sources.filter(s => 'estimate' in s.src).map(s => s.field), sources,
    });
  }
  return { kind, moveS, cycleS, joints, skipped, pending: PENDING_WORKED_EXAMPLES.slice(), sampling: `the move out and back, each segment at its ends and ${SAMPLES} samples (Simpson's rule for RMS, cube mean and mean speed); the dwells exact; the chosen pair's peaks and least envelope margin refined by golden section and checked again; the load inertia at the segment ends` };
}

/**
 * One given pair's checks for one joint over the cycle sizeActuators runs (the move out and back, dwells held), refined
 * as its chosen pair is — every check, failing ones too (RD9's harness, O46: a design's margins, negative ones named).
 */
export function checkPair(tree: JointTree, bodies: ReadonlyMap<string, LinkBody>, q0: Readonly<Record<string, number>>, q1: Readonly<Record<string, number>>, kind: ProfileKind, limits: (key: string) => MoveLimits, key: string, motor: Motor, reducer: Reducer, opts: SizeOptions = {}): Check[] {
  const g = opts.g ?? [0, 0, -STANDARD_GRAVITY], dwell = opts.dwell ?? 0;
  const out = moveMotion(tree, q0, q1, kind, limits), back = moveMotion(tree, q1, q0, kind, limits), tracks = [track(tree, bodies, out, g), track(tree, bodies, back, g)];
  const cycleS = 2 * (out.profile?.duration ?? 0) + 2 * dwell, zero = Object.fromEntries(out.keys.map(k => [k, 0])), hold = [rnea(tree, bodies, q1, zero, zero, g), rnea(tree, bodies, q0, zero, zero, g)];
  const poses: Record<string, number>[] = [{ ...zero, ...q0 }, { ...zero, ...q1 }];
  for (const tr of tracks) for (const s of tr.segs) poses.push(moveState(tr.motion, s.seg, s.seg.t1).q);
  const jLoad = Math.max(...poses.map(q => { const { keys, M } = massMatrix(tree, bodies, q), i = keys.indexOf(key); return M[i][i]; }));
  const d = drive(motor, reducer), T = refine({ tree, bodies, g, d, key }, tracks, totals(d, key, tracks, hold.map(h => h[key]), dwell));
  return checks(d, motor, reducer, T, cycleS || 1, jLoad, opts, opts.estop === undefined ? null : stopTorque(tree, bodies, tracks, key, opts.estop, g));
}

/** One point mass added to a link (its mass, centre and inertia about it — world, kg·m² — by the parallel-axis rule). */
export function withPointMass(b: LinkBody, massKg: number, at: V3): LinkBody {
  const M = b.massKg + massKg; if (!(M > 0)) return b;
  const c: V3 = [0, 1, 2].map(i => (b.massKg * b.com[i] + massKg * at[i]) / M) as V3, I = b.I.slice() as LinkBody['I'];
  // (Each mass about the new centre: m (|d|² δ − d dᵀ), d in metres.)
  for (const [m, p] of [[b.massKg, b.com], [massKg, at]] as [number, V3][]) {
    const d = [0, 1, 2].map(i => (p[i] - c[i]) / 1000), dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) I[i * 3 + j] += m * ((i === j ? dd : 0) - d[i] * d[j]);
  }
  return { ...b, massKg: M, com: c, I };
}
export interface CoupledSizing { sizing: Sizing; rounds: number; settled: boolean; added: { joint: string; link: string; massKg: number }[]; bodies: Map<string, LinkBody> }
/**
 * Sizing with the actuators' own mass (O75): each chosen pair a point mass at its joint's axis point on the joint's
 * parent link (the motor and reducer sit there and drive the child), sized again, until the choices are the same twice
 * (at most `rounds`); `settled` false when they still change.
 */
export function sizeCoupled(tree: JointTree, bodies0: ReadonlyMap<string, LinkBody>, q0: Readonly<Record<string, number>>, q1: Readonly<Record<string, number>>, kind: ProfileKind, limits: (key: string) => MoveLimits, opts: SizeOptions = {}, rounds = 6): CoupledSizing {
  let bodies = new Map(bodies0), sizing = sizeActuators(tree, bodies, q0, q1, kind, limits, opts), added: CoupledSizing['added'] = [];
  const sig = (s: Sizing) => s.joints.map(j => `${j.key}:${j.choice ? `${j.choice.motor}+${j.choice.reducer}` : '-'}`).join('|');
  for (let k = 1; k <= rounds; k++) {
    bodies = new Map(bodies0); added = [];
    for (const j of sizing.joints) {
      const joint = tree.joints.find(x => x.key === j.key); if (!j.choice || !joint) continue;
      const parent = bodies.get(joint.parent); if (!parent) continue;
      bodies.set(joint.parent, withPointMass(parent, j.choice.massKg, joint.origin as V3)); added.push({ joint: j.key, link: joint.parent, massKg: j.choice.massKg });
    }
    const next = sizeActuators(tree, bodies, q0, q1, kind, limits, opts), same = sig(next) === sig(sizing);
    sizing = next;
    if (same) return { sizing, rounds: k, settled: true, added, bodies };
  }
  return { sizing, rounds, settled: false, added, bodies };
}

/** Reads catalogue entries given by a caller: every field a value with a unit known here and a source. */
export function readCatalogue(raw: unknown, fields: readonly string[], what: string): { entries: Record<string, unknown>[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: `"${what}" is a list of entries.` };
  for (const [i, e] of raw.entries()) {
    if (!e || typeof e !== 'object' || typeof (e as { id?: unknown }).id !== 'string' || typeof (e as { name?: unknown }).name !== 'string') return { error: `${what}[${i}] needs an id and a name.` };
    for (const f of fields) {
      const x = (e as Record<string, unknown>)[f] as Value | undefined;
      if (!x || typeof x.v !== 'number' || !Number.isFinite(x.v) || typeof x.unit !== 'string' || UNITS[x.unit] === undefined) return { error: `${what}[${i}].${f} is {v, unit, src} with a unit of ${Object.keys(UNITS).filter(Boolean).join(', ')}.` };
      const s = x.src as Record<string, unknown> | undefined;
      const ok = !!s && ((typeof s.page === 'string' && typeof s.read === 'string' && typeof s.label === 'string') || typeof s.derived === 'string' || typeof s.estimate === 'string');
      if (!ok) return { error: `${what}[${i}].${f} needs its source: {page, read, label} (the URL, the date read, the page's label), {derived} or {estimate} — no value without one.` };
      if (!(x.v > 0) && f !== 'noLoadCurrent') return { error: `${what}[${i}].${f} is above 0.` };
    }
  }
  return { entries: raw as Record<string, unknown>[] };
}
