/** Explicit, intentionally importable native calculation contract. Turning poses/limits are radians,
 * slides and clearance mm, dwell s, life_h hours, g m/s²; dynamics retain existing SI quantities.
 * readDuty/moveArgs decode canonical public inputs once. This is not a second public-hours schema. */
import type { JointTree } from '../joints';
import type { V3 } from '../inertia';
import type { ProfileKind } from '../profile';
import type { MoveLimits } from '../dynamics';
import { jointValuesIn, moveLimitsIn } from '../units';
import { gravityIn } from '../reports';

export interface NativeDutyMove { from: Record<string, number>; to: Record<string, number>; profile: ProfileKind; limits?: MoveLimits; joint_limits?: Record<string, MoveLimits>; dwell_s?: number }
export interface NativeDuty {
  moves: NativeDutyMove[]; life_h?: number; inertia_ratio_max?: number; clearance_mm?: number; g?: V3;
  /** The actuators to check, by joint; absent: RD3's lightest feasible pair for each move. */
  actuators?: Record<string, { motor: string; reducer: string }>;
}
export function moveArgs(tree: JointTree, args: Record<string, unknown>): { from: Record<string, number>; to: Record<string, number>; profile: ProfileKind; limits: (k: string) => MoveLimits } | { error: string } {
  const keys = new Set(tree.joints.map(j => j.key)), from = (args.from ?? {}) as Record<string, unknown>, to = (args.to ?? {}) as Record<string, unknown>;
  for (const v of [from, to]) {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.values(v).some(x => typeof x !== 'number' || !Number.isFinite(x))) return { error: '"from" and "to" are {joint key: number}.' };
    const bad = Object.keys(v).filter(k => !keys.has(k)); if (bad.length) return { error: `No joint ${bad.join(', ')}; joints: ${[...keys].join(', ') || 'none'}.` };
  }
  if (args.profile !== 'trapezoid' && args.profile !== 's-curve') return { error: '"profile" is "trapezoid" or "s-curve".' };
  const ok = (l: unknown): l is MoveLimits => !!l && typeof l === 'object' && typeof (l as MoveLimits).velocity === 'number' && (l as MoveLimits).velocity > 0 && typeof (l as MoveLimits).acceleration === 'number' && (l as MoveLimits).acceleration > 0 && ((l as MoveLimits).jerk === undefined || (typeof (l as MoveLimits).jerk === 'number' && (l as MoveLimits).jerk! > 0));
  const per = (args.joint_limits ?? {}) as Record<string, unknown>, all = args.limits;
  const moving = Object.keys({ ...from, ...to }).filter(k => ((to[k] as number) ?? 0) !== ((from[k] as number) ?? 0));
  for (const k of moving) { const l = per[k] ?? all; if (!ok(l)) return { error: `${k}: give its limits (velocity and acceleration above 0${args.profile === 's-curve' ? ', and jerk for an S-curve' : ''}) in "limits" or "joint_limits" — none is assumed.` }; if (args.profile === 's-curve' && (l as MoveLimits).jerk === undefined) return { error: `${k}: an S-curve needs a jerk limit.` }; }
  return { from: jointValuesIn(tree, from as Record<string, number>), to: jointValuesIn(tree, to as Record<string, number>), profile: args.profile, limits: k => moveLimitsIn(tree, k, (per[k] ?? all) as MoveLimits) };
}

/** A duty as given (JSON), each move checked as motion_torques takes one; or why not. */
export function readDuty(tree: JointTree, raw: unknown): NativeDuty | { error: string } {
  const d = raw as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || Array.isArray(d) || !Array.isArray(d.moves) || !d.moves.length) return { error: 'a duty has "moves": [{from, to, profile, limits | joint_limits, dwell?}, …]' };
  const extra = Object.keys(d).filter(k => !['moves', 'serviceLife', 'inertia_ratio_max', 'clearance', 'g', 'actuators'].includes(k));
  if (extra.length) return { error: `No duty field ${extra.join(', ')}.` };
  const moves: NativeDuty['moves'] = [];
  for (const [i, m] of (d.moves as Record<string, unknown>[]).entries()) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return { error: `move ${i} is an object.` };
    const extra = Object.keys(m).filter(k => !['from', 'to', 'profile', 'limits', 'joint_limits', 'dwell'].includes(k));
    if (extra.length) return { error: `move ${i}: no field ${extra.join(', ')}.` };
    const a = moveArgs(tree, m); if ('error' in a) return { error: `move ${i}: ${a.error}` };
    const moving = Object.keys({ ...a.from, ...a.to }).filter(k => (a.from[k] ?? 0) !== (a.to[k] ?? 0));
    for (const key of moving) if (Object.values(a.limits(key)).some(v => !Number.isFinite(v))) return { error: `move ${i}: ${key}: limits must be finite numbers.` };
    const dwell = m.dwell ?? 0; if (typeof dwell !== 'number' || !Number.isFinite(dwell) || !(dwell >= 0)) return { error: `move ${i}: "dwell" is a time of 0 s or more` };
    moves.push({ from: a.from, to: a.to, profile: a.profile, joint_limits: Object.fromEntries(Object.keys({ ...a.from, ...a.to }).filter(k => (a.from[k] ?? 0) !== (a.to[k] ?? 0)).map(k => [k, a.limits(k)])), dwell_s: dwell });
  }
  const num = (k: string) => { const v = d[k]; return v === undefined ? undefined : typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : NaN; };
  for (const k of ['serviceLife', 'inertia_ratio_max']) if (Number.isNaN(num(k))) return { error: `"${k}" is a number above 0` };
  if (d.clearance !== undefined && !(typeof d.clearance === 'number' && Number.isFinite(d.clearance) && d.clearance >= 0)) return { error: '"clearance" is 0 or more' };
  if (d.g !== undefined && (!Array.isArray(d.g) || d.g.length !== 3 || d.g.some(x => typeof x !== 'number' || !Number.isFinite(x)))) return { error: '"g" is [x, y, z] in mm/s².' };
  return { moves, ...(num('serviceLife') ? { life_h: num('serviceLife')! / 3600 } : {}), ...(num('inertia_ratio_max') ? { inertia_ratio_max: num('inertia_ratio_max') } : {}), ...(d.clearance !== undefined ? { clearance_mm: d.clearance as number } : {}), ...(d.actuators ? { actuators: d.actuators as NativeDuty['actuators'] } : {}), g: gravityIn(d.g as V3 | undefined) };
}
