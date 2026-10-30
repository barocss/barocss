/** Native-only solver entry: NativeDuty uses radians, mm, seconds, hours and SI gravity.
 * Intentionally importable; canonical callers use robot/harness. */
// The design-check harness v1 (RD9, O46): one report of every margin a robot design has against its duty, without FEA.
// For each move of the duty (run out and back, dwells held, as RD3 runs it): each turning joint's actuator checks
// (RD3: the given pair's, or the lightest feasible pair's), its range, velocity and effort ratings (RM1's settings
// against RD2's profile and torques), the move's sweep (RM6: certified clear, its least clearance); and at each move's
// ends the model's own consistency (RNEA's holding torques against RD1's gravity torques; the mass matrix symmetric and
// positive definite). A margin is the signed slack — (limit − value) / |limit| for an at-most limit — and the report is
// ok only when every margin is above 0, nothing is unknown and the model is consistent. What cannot be checked is
// unknown, typed, never a pass.
import type { JointTree } from '../joints';
import { coordinates, gravityTorques, massMatrix, moveTorques, rnea, STANDARD_GRAVITY, type LinkBody, type MoveLimits } from '../dynamics';
import { checkPair, MOTORS, REDUCERS, sizeActuators, type Motor, type Reducer } from '../actuators';
import { sweepPath, type SweepLink } from '../sweep';

import type { NativeDuty, NativeDutyMove } from './duty';

export interface Margin { check: string; joint?: string; move?: number; value: number; limit: number; unit: string; margin: number; source: string; ok: boolean; detail?: string }
export type UnknownCode = 'LIMITS_MISSING' | 'NO_ACTUATOR' | 'NOT_SIZED';
export interface Unknown { check: string; joint?: string; move?: number; code: UnknownCode; why: string }
export interface Consistency { check: string; move: number; at: 'from' | 'to'; ok: boolean; value: number; tol: number }
export interface HarnessReport { ok: boolean; margins: Margin[]; unknowns: Unknown[]; consistency: Consistency[]; least: { check: string; joint?: string; move?: number; margin: number } | null; actuators: Record<string, { motor: string; reducer: string }[]>; notes: string[] }

// Raw quantities for the public unit projection only. The core report retains its original rounded values.
const rawMargins = new WeakMap<Margin, { value: number; limit: number; unit: string; publishedValue: number; publishedLimit: number }>();
function trackedMargin(margin: Margin, value: number, limit: number): Margin {
  rawMargins.set(margin, { value, limit, unit: margin.unit, publishedValue: margin.value, publishedLimit: margin.limit });
  return margin;
}
/** Internal projection lookup: clones and edited quantity fields do not acquire raw provenance. */
export function marginQuantitiesOf(margin: Margin): { readonly value: number; readonly limit: number } | undefined {
  const raw = rawMargins.get(margin);
  return raw && raw.unit === margin.unit && Object.is(raw.publishedValue, margin.value) && Object.is(raw.publishedLimit, margin.limit) ? raw : undefined;
}

const r9 = (v: number) => (Number.isFinite(v) ? Math.round(v * 1e9) / 1e9 + 0 : v);
const atMost = (check: string, value: number, limit: number, unit: string, source: string, o: { joint?: string; move?: number; detail?: string } = {}): Margin => {
  const margin = limit ? (limit - value) / Math.abs(limit) : value <= 0 ? 0 : -Infinity;
  return trackedMargin({ check, ...(o.joint ? { joint: o.joint } : {}), ...(o.move !== undefined ? { move: o.move } : {}), value: r9(value), limit: r9(limit), unit, margin: r9(margin), source, ok: margin > 0, ...(o.detail ? { detail: o.detail } : {}) }, value, limit);
};
const limitsOf = (m: NativeDutyMove) => (k: string): MoveLimits => (m.joint_limits?.[k] ?? m.limits)!;

/** Every margin of a design against its duty (see the head of this file). `sweep`: the links for RM6's sweep, or null to leave it out (noted). */
export function checkDesign(tree: JointTree, bodies: ReadonlyMap<string, LinkBody>, sweep: readonly SweepLink[] | null, duty: NativeDuty, catalogue: { motors?: readonly Motor[]; reducers?: readonly Reducer[] } = {}): HarnessReport {
  const g = duty.g ?? [0, 0, -STANDARD_GRAVITY], motors = catalogue.motors ?? MOTORS, reducers = catalogue.reducers ?? REDUCERS;
  const margins: Margin[] = [], unknowns: Unknown[] = [], consistency: Consistency[] = [], notes: string[] = [], used: HarnessReport['actuators'] = {};
  const keys = coordinates(tree), turning = keys.filter(k => tree.joints.find(j => j.key === k)!.type !== 'prismatic');
  for (const k of keys) if (!turning.includes(k)) notes.push(`${k}: a slide — no linear actuator data yet, its actuator not checked`);
  if (!sweep) notes.push('the sweep was not run (no link meshes given)');
  const opts = { dwell: 0, inertiaRatio: duty.inertia_ratio_max, ...(duty.life_h !== undefined ? { life: duty.life_h } : {}), g, motors, reducers };
  duty.moves.forEach((m, i) => {
    const lim = limitsOf(m), o = { ...opts, dwell: m.dwell_s ?? 0 };
    // ——— RM: the joints' ranges, velocity and effort ratings
    const out = moveTorques(tree, bodies, m.from, m.to, m.profile, lim, g), back = moveTorques(tree, bodies, m.to, m.from, m.profile, lim, g);
    const zero = Object.fromEntries(keys.map(k => [k, 0])), holds = [rnea(tree, bodies, m.from, zero, zero, g), rnea(tree, bodies, m.to, zero, zero, g)];
    for (const k of keys) {
      const j = tree.joints.find(x => x.key === k)!, l = j.limit, unit = j.type === 'prismatic' ? 'mm' : 'rad';
      if (j.type === 'continuous') { if (i === 0) notes.push(`${k}: continuous — no range to check`); }
      else if (l?.lower === undefined || l.upper === undefined) unknowns.push({ check: 'joint range', joint: k, move: i, code: 'LIMITS_MISSING', why: `${k} has no lower and upper limit` });
      else for (const [end, q] of [['from', m.from[k] ?? 0], ['to', m.to[k] ?? 0]] as const) {
        const span = l.upper - l.lower, slack = Math.min(q - l.lower, l.upper - q), near = q - l.lower < l.upper - q ? l.lower : l.upper;
        margins.push(trackedMargin({ check: 'joint range', joint: k, move: i, value: r9(q), limit: r9(near), unit, margin: r9(slack / span), source: 'robot.joints', ok: slack > 0, detail: end }, q, near));
      }
      const vPeak = Math.max(out.joints[k].vPeak, back.joints[k].vPeak), peak = Math.max(out.joints[k].peak, back.joints[k].peak, Math.abs(holds[0][k]), Math.abs(holds[1][k]));
      if (vPeak > 0) { if (l?.velocity === undefined) unknowns.push({ check: 'joint velocity', joint: k, move: i, code: 'LIMITS_MISSING', why: `${k} has no velocity rating` }); else margins.push(atMost('joint velocity', vPeak, l.velocity, `${unit}/s`, 'robot.joints', { joint: k, move: i })); }
      if (peak > 0) { if (l?.effort === undefined) unknowns.push({ check: 'joint effort', joint: k, move: i, code: 'LIMITS_MISSING', why: `${k} has no effort rating` }); else margins.push(atMost('joint effort', peak, l.effort, j.type === 'prismatic' ? 'N' : 'N·m', 'robot.joints', { joint: k, move: i })); }
    }
    // ——— RD3: the actuators, the given pair's checks or the lightest feasible pair's
    const sized = duty.actuators ? null : sizeActuators(tree, bodies, m.from, m.to, m.profile, lim, o);
    for (const k of turning) {
      let pair: { m: Motor; r: Reducer } | null = null;
      if (duty.actuators) {
        const a = duty.actuators[k], mo = a && motors.find(x => x.id === a.motor), re = a && reducers.find(x => x.id === a.reducer);
        if (!a || !mo || !re) { unknowns.push({ check: 'actuator', joint: k, move: i, code: 'NO_ACTUATOR', why: !a ? `no actuator given for ${k}` : `${!mo ? `no motor ${a.motor}` : `no reducer ${a.reducer}`} in the catalogue` }); continue; }
        pair = { m: mo, r: re };
      } else {
        const js = sized!.joints.find(x => x.key === k);
        if (!js) continue; // (neither moves nor holds a load in this move: nothing to size)
        if (!js.choice) { unknowns.push({ check: 'actuator', joint: k, move: i, code: 'NOT_SIZED', why: `no catalogue pair meets every check (${Object.entries(js.rejected).map(([n, c]) => `${n}: ${c}`).join(', ')})` }); continue; }
        pair = { m: motors.find(x => x.id === js.choice!.motor)!, r: reducers.find(x => x.id === js.choice!.reducer)! };
      }
      (used[k] ??= []).push({ motor: pair.m.id, reducer: pair.r.id });
      for (const c of checkPair(tree, bodies, m.from, m.to, m.profile, lim, k, pair.m, pair.r, o)) {
        if (c.name === 'reducer life L10' && duty.life_h === undefined) continue;
        margins.push(trackedMargin({ check: c.name, joint: k, move: i, value: r9(c.value), limit: r9(c.limit), unit: c.unit, margin: r9(c.margin), source: `${pair.m.id} + ${pair.r.id} (${c.limitSource})`, ok: c.ok && c.margin > 0 }, c.value, c.limit));
      }
    }
    // ——— RM6: the sweep
    if (sweep) {
      const s = sweepPath(tree, sweep, m.from, m.to), req = duty.clearance_mm ?? 0;
      if (s.exhausted) margins.push(trackedMargin({ check: 'sweep', move: i, value: r9(s.minClearance?.mm ?? Infinity), limit: r9(req), unit: 'mm', margin: -1, source: 'RM6', ok: false, detail: `not certified: the sweep ran out of its sample budget at s ${r9(s.exhausted.s)} (least clearance ${s.minClearance ? r9(s.minClearance.mm) + ' mm' : 'none met'})` }, s.minClearance?.mm ?? Infinity, req));
      else if (!s.clear) margins.push(trackedMargin({ check: 'sweep', move: i, value: 0, limit: r9(req), unit: 'mm', margin: -1, source: 'RM6', ok: false, detail: `contact ${s.contact!.links.join('–')} at s ${r9(s.contact!.s)}` }, 0, req));
      else { const mm = s.minClearance?.mm ?? Infinity; margins.push(trackedMargin({ check: 'sweep', move: i, value: r9(mm), limit: r9(req), unit: 'mm', margin: r9((mm - req) / Math.max(req, 1)), source: 'RM6', ok: mm > req, ...(s.minClearance ? { detail: `least ${s.minClearance.links.join('–')} at s ${r9(s.minClearance.s)}` } : {}) }, mm, req)); }
    }
    // ——— consistency: RNEA's holding torques against RD1's; the mass matrix SPD
    for (const [at, q] of [['from', m.from], ['to', m.to]] as const) {
      const h = rnea(tree, bodies, q, zero, zero, g), G = gravityTorques(tree, bodies, q, g).torques, scale = Math.max(1, ...keys.map(k => Math.abs(h[k])));
      const d = Math.max(0, ...keys.map(k => Math.abs(h[k] - (G[k] ?? 0))));
      consistency.push({ check: 'holding torque: RNEA = RD1', move: i, at, ok: d <= 1e-9 * scale, value: d, tol: 1e-9 * scale });
      const { M } = massMatrix(tree, bodies, q), n = M.length; let asym = 0, spd = true;
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) asym = Math.max(asym, Math.abs(M[a][b] - M[b][a]));
      const L = M.map(r => r.map(() => 0));
      for (let a = 0; a < n && spd; a++) for (let b = 0; b <= a; b++) { let s = M[a][b]; for (let k = 0; k < b; k++) s -= L[a][k] * L[b][k]; if (a === b) { if (!(s > 0)) { spd = false; break; } L[a][a] = Math.sqrt(s); } else L[a][b] = s / L[b][b]; }
      const mscale = Math.max(1e-300, ...M.map((r, a) => Math.abs(r[a])));
      consistency.push({ check: 'mass matrix symmetric, positive definite', move: i, at, ok: spd && asym <= 1e-12 * mscale, value: asym, tol: 1e-12 * mscale });
    }
  });
  const least = margins.reduce<Margin | null>((a, b) => (!a || b.margin < a.margin ? b : a), null);
  return { ok: margins.every(x => x.ok) && !unknowns.length && consistency.every(c => c.ok), margins, unknowns, consistency, least: least ? { check: least.check, ...(least.joint ? { joint: least.joint } : {}), ...(least.move !== undefined ? { move: least.move } : {}), margin: least.margin } : null, actuators: used, notes };
}
