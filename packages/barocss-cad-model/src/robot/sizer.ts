// The scripted sizer (RD10, O46; the deterministic part): a robot design taken until every margin of RD9's harness is
// above 0, one change a round. Each round checks the design and takes its worst failing margin (or an unknown) and
// applies one rule: an actuator check fails, or a joint has no actuator → the joint takes the lightest catalogue pair
// that passes every RD3 check in every move (none: every move slows, velocity and acceleration × 0.8); a velocity or
// effort rating fails or is missing → it becomes the joint's actuator's capability (min(motor max speed, reducer max
// input speed) / N; the reducer's repeated peak torque); a range or a sweep fails → no sizing rule changes geometry:
// BRIEF_INFEASIBLE, never done. Each round's trace names the check that drove it and the change made.
import type { JointTree } from './joints';
import type { LinkBody } from './dynamics';
import type { SweepLink } from './sweep';
import { checkPair, MOTORS, REDUCERS, si, type Motor, type Reducer } from './actuators';
import { checkDesign, type Duty, type HarnessReport, type Margin, type Unknown } from './harness';

export type SizerCode = 'BRIEF_INFEASIBLE' | 'NOT_CONVERGED';
export interface Round { round: number; check: string; joint?: string; move?: number; margin: number | null; change: string }
export interface Sized { ok: boolean; rounds: number; trace: Round[]; tree: JointTree; duty: Duty; report: HarnessReport; stopped?: { code: SizerCode; why: string } }

const RPM = 60 / (2 * Math.PI);
/** The lightest pair (by mass, then id) passing every RD3 check in every move of the duty; null when none does. */
function lightestPair(tree: JointTree, bodies: ReadonlyMap<string, LinkBody>, duty: Duty, key: string, motors: readonly Motor[], reducers: readonly Reducer[]): { m: Motor; r: Reducer } | null {
  const pairs = motors.flatMap(m => reducers.map(r => ({ m, r }))).sort((a, b) => si(a.m.mass) + si(a.r.mass) - (si(b.m.mass) + si(b.r.mass)) || (a.m.id + a.r.id < b.m.id + b.r.id ? -1 : 1));
  const opts = { inertiaRatio: duty.inertia_ratio_max, ...(duty.life_h !== undefined ? { life: duty.life_h } : {}), ...(duty.g ? { g: duty.g } : {}) };
  for (const p of pairs) {
    const ok = duty.moves.every(mv => checkPair(tree, bodies, mv.from, mv.to, mv.profile, k => (mv.joint_limits?.[k] ?? mv.limits)!, key, p.m, p.r, { ...opts, dwell: mv.dwell_s ?? 0 }).every(c => c.ok && c.margin > 0));
    if (ok) return p;
  }
  return null;
}
const withRating = (tree: JointTree, key: string, patch: { velocity?: number; effort?: number }): JointTree => ({ ...tree, joints: tree.joints.map(j => (j.key === key ? { ...j, limit: { ...j.limit, ...patch } } : j)) });
const slowed = (duty: Duty): Duty => ({ ...duty, moves: duty.moves.map(m => ({ ...m, ...(m.limits ? { limits: { ...m.limits, velocity: m.limits.velocity * 0.8, acceleration: m.limits.acceleration * 0.8, ...(m.limits.jerk ? { jerk: m.limits.jerk * 0.8 } : {}) } } : {}), ...(m.joint_limits ? { joint_limits: Object.fromEntries(Object.entries(m.joint_limits).map(([k, l]) => [k, { ...l, velocity: l.velocity * 0.8, acceleration: l.acceleration * 0.8, ...(l.jerk ? { jerk: l.jerk * 0.8 } : {}) }])) } : {}) })) });
const r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
/** A pair's capability at the joint: velocity min(motor max speed, reducer max input speed) / N (rad/s); effort the reducer's repeated peak torque (N·m). */
export const capability = (m: Motor, r: Reducer) => ({ velocity: r6(Math.min(si(m.maxSpeed), si(r.maxInputSpeed)) / si(r.ratio) / RPM), effort: si(r.repeatedPeakTorque) });
function holdRatings(tree: JointTree, key: string, m: Motor, r: Reducer): { tree: JointTree; note: string } {
  const l = tree.joints.find(j => j.key === key)?.limit ?? {}, cap = capability(m, r), patch: { velocity?: number; effort?: number } = {};
  if (l.velocity !== undefined && l.velocity > cap.velocity) patch.velocity = cap.velocity;
  if (l.effort !== undefined && l.effort > cap.effort) patch.effort = cap.effort;
  return Object.keys(patch).length ? { tree: withRating(tree, key, patch), note: `; its ratings held to its capability (${Object.entries(patch).map(([k, v]) => `${k} ${v}`).join(', ')})` } : { tree, note: '' };
}
const RD3_CHECKS = new Set(['motor RMS torque', 'motor torque–speed line', 'motor speed', 'inertia ratio', 'reducer repeated peak torque', 'reducer input speed', 'reducer average torque', 'reducer average input speed', 'reducer life L10']);

/** The design sized until every margin is above 0 (see the head of this file); at most `maxRounds` rounds. */
export function sizeDesign(tree0: JointTree, bodies: ReadonlyMap<string, LinkBody>, sweep: readonly SweepLink[] | null, duty0: Duty, o: { maxRounds?: number; motors?: readonly Motor[]; reducers?: readonly Reducer[] } = {}): Sized {
  const motors = o.motors ?? MOTORS, reducers = o.reducers ?? REDUCERS, max = o.maxRounds ?? 10, trace: Round[] = [];
  let tree = tree0, duty: Duty = { ...duty0, actuators: { ...duty0.actuators } };
  for (let round = 1; ; round++) {
    const report = checkDesign(tree, bodies, sweep, duty, { motors, reducers });
    if (report.ok) return { ok: true, rounds: round - 1, trace, tree, duty, report };
    if (round > max) return { ok: false, rounds: round - 1, trace, tree, duty, report, stopped: { code: 'NOT_CONVERGED', why: `${max} rounds, still ${report.margins.filter(m => !m.ok).length} failing margins and ${report.unknowns.length} unknowns` } };
    if (!report.margins.some(m => !m.ok) && !report.unknowns.length) {
      const bad = report.consistency.find(c => !c.ok)!;
      trace.push({ round, check: bad.check, move: bad.move, margin: null, change: 'stopped: BRIEF_INFEASIBLE' });
      return { ok: false, rounds: round, trace, tree, duty, report, stopped: { code: 'BRIEF_INFEASIBLE', why: `the model is inconsistent (${bad.check} at move ${bad.move} ${bad.at}): not a sizing question` } };
    }
    // (The worst: a failing margin, least first (then in report order); else the first unknown.)
    const failing = report.margins.filter(m => !m.ok), worst: Margin | Unknown = failing.length ? failing.reduce((a, b) => (b.margin < a.margin ? b : a)) : report.unknowns[0] ?? report.margins[0];
    const at = { round, check: worst.check, ...(worst.joint ? { joint: worst.joint } : {}), ...(worst.move !== undefined ? { move: worst.move } : {}), margin: 'margin' in worst ? worst.margin : null };
    if (worst.check === 'joint range' || worst.check === 'sweep') {
      const why = `${worst.check}${worst.joint ? ` ${worst.joint}` : ''} fails in move ${worst.move}${'detail' in worst && worst.detail ? ` (${worst.detail})` : ''}: no sizing rule changes the geometry or the duty's poses`;
      trace.push({ ...at, change: 'stopped: BRIEF_INFEASIBLE' });
      return { ok: false, rounds: round, trace, tree, duty, report, stopped: { code: 'BRIEF_INFEASIBLE', why } };
    }
    const key = worst.joint!;
    if (RD3_CHECKS.has(worst.check) || worst.check === 'actuator') {
      const p = lightestPair(tree, bodies, duty, key, motors, reducers);
      if (p) {
        duty = { ...duty, actuators: { ...duty.actuators, [key]: { motor: p.m.id, reducer: p.r.id } } };
        // (Its ratings held within the new pair's capability: one set from the old pair may be past what this one can give.)
        const held = holdRatings(tree, key, p.m, p.r); tree = held.tree;
        trace.push({ ...at, change: `${key}: ${p.m.id} + ${p.r.id}, the lightest pair passing every RD3 check in every move${held.note}` });
      }
      else { duty = slowed(duty); trace.push({ ...at, change: `no pair passes for ${key}: every move slowed (velocity and acceleration × 0.8)` }); }
      continue;
    }
    if (worst.check === 'joint velocity' || worst.check === 'joint effort') {
      // (The rating as the joint's actuator can give: its own, else the one the next round would choose.)
      const a = duty.actuators?.[key], mo = a && motors.find(x => x.id === a.motor), re = a && reducers.find(x => x.id === a.reducer);
      if (!mo || !re) { const p = lightestPair(tree, bodies, duty, key, motors, reducers); if (p) { duty = { ...duty, actuators: { ...duty.actuators, [key]: { motor: p.m.id, reducer: p.r.id } } }; trace.push({ ...at, change: `${key}: ${p.m.id} + ${p.r.id} first, to rate the joint by` }); } else { duty = slowed(duty); trace.push({ ...at, change: `no pair passes for ${key}: every move slowed (× 0.8)` }); } continue; }
      if (worst.check === 'joint velocity') {
        const v = capability(mo, re).velocity;
        tree = withRating(tree, key, { velocity: v }); trace.push({ ...at, change: `${key}: velocity rating ${v} rad/s, min(motor max speed, reducer max input speed) / N` });
      } else {
        const e = si(re.repeatedPeakTorque);
        tree = withRating(tree, key, { effort: e }); trace.push({ ...at, change: `${key}: effort rating ${e} N·m, the reducer's repeated peak torque` });
      }
      continue;
    }
    // (Anything else — a consistency failure: the model itself is wrong; nothing to size.)
    trace.push({ ...at, change: 'stopped: BRIEF_INFEASIBLE' });
    return { ok: false, rounds: round, trace, tree, duty, report, stopped: { code: 'BRIEF_INFEASIBLE', why: `${worst.check}: not a sizing question` } };
  }
}
