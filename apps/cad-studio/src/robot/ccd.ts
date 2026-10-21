// Continuous collision along a timed, multi-segment joint path (RM9a, O62). Each segment is straight in joint space,
// q(t) = q⁰ + u(t)(q¹ − q⁰), timed by one normalised profile u over distance 1 (RD2's trapezoid or S-curve) whose limits are
// the tightest joint's — v′ = minᵢ vᵢ/|Δqᵢ|, a′ = minᵢ aᵢ/|Δqᵢ|, j′ = minᵢ jᵢ/|Δqᵢ| — so every joint starts and stops together
// and none passes its own limits. u is monotone, so the segment's path in s = u(t) is RM6's straight move: its
// conservative advancement certifies it, at a clearance tolerance of 1e-9 mm, and the first sample where the clearance
// reaches it is the time of impact (to the step's 1e-12 in s). The time is u's inverse there, by bisection to the double's
// precision. Everything before it is certified free; the contact at it is met to the tolerance.
import type { JointTree } from '@barocss/cad-model/robot/joints';
import { at, sCurve, trapezoid, type Profile, type ProfileKind } from '@barocss/cad-model/robot/profile';
import { sweepPath, type SweepLink, type SweepResult } from '@barocss/cad-model/robot/sweep';

export interface JointLimits { v: number; a: number; j?: number }
export interface TimedPath {
  /** The waypoints' joint values by key (absent: 0), at least two. */
  waypoints: readonly Readonly<Record<string, number>>[];
  profile: ProfileKind;
  /** Each joint's limits (rad/s, rad/s², rad/s³ or mm/s… for a slide); `default` for the rest. */
  limits: Readonly<Record<string, JointLimits>> & { default?: JointLimits };
}
export interface TimedSegment { from: Readonly<Record<string, number>>; to: Readonly<Record<string, number>>; t0: number; duration: number; profile: Profile | null }
export interface TimedSweep {
  clear: boolean;
  /** The time of impact (s from the path's start), its segment, the two links and the joint values there. */
  toi?: number; segment?: number; links?: [string, string]; values?: Record<string, number>;
  /** The least clearance met (mm), when and between which links. */
  minClearance: { mm: number; t: number; links: [string, string] } | null;
  /** Each sample's least clearance over the pairs, as [t, mm], in time order. */
  clearanceProfile: [number, number][];
  segments: TimedSegment[]; samples: number; skipped: SweepResult['skipped'];
}
export class CcdError extends Error { constructor(message: string) { super(message); this.name = 'CcdError'; } }

/** The clearance counted as contact (mm) for the time of impact. */
export const CCD_TOLERANCE = 1e-9;

/** The segments' timing: each one's normalised profile over distance 1, its limits the tightest joint's. */
export function timePath(tree: JointTree, path: TimedPath): TimedSegment[] {
  if (path.waypoints.length < 2) throw new CcdError('a path needs at least two waypoints');
  const keys = tree.joints.filter(j => j.type !== 'fixed' && !j.mimic).map(j => j.key), out: TimedSegment[] = [];
  let t = 0;
  for (let k = 0; k + 1 < path.waypoints.length; k++) {
    const from = path.waypoints[k], to = path.waypoints[k + 1];
    let v = Infinity, a = Infinity, j = Infinity;
    for (const key of keys) {
      const d = Math.abs((to[key] ?? 0) - (from[key] ?? 0)); if (!(d > 0)) continue;
      const l = path.limits[key] ?? path.limits.default;
      if (!l || !(l.v > 0 && l.a > 0) || (path.profile === 's-curve' && !((l.j ?? 0) > 0))) throw new CcdError(`joint ${key} has no ${path.profile === 's-curve' ? 'velocity, acceleration and jerk' : 'velocity and acceleration'} limits above 0`);
      v = Math.min(v, l.v / d); a = Math.min(a, l.a / d); if (l.j !== undefined) j = Math.min(j, l.j / d);
    }
    const profile = v === Infinity ? null : path.profile === 's-curve' ? sCurve(1, v, a, j) : trapezoid(1, v, a);
    out.push({ from, to, t0: t, duration: profile?.duration ?? 0, profile });
    t += profile?.duration ?? 0;
  }
  return out;
}
/** The time within a segment at which its progress u(t) reaches s, by bisection (u is monotone). */
export function timeAt(profile: Profile | null, s: number): number {
  if (!profile) return 0;
  if (s <= 0) return 0;
  if (s >= 1) return profile.duration;
  let lo = 0, hi = profile.duration;
  for (let i = 0; i < 200 && hi - lo > 0; i++) { const m = (lo + hi) / 2; if (m === lo || m === hi) break; if (at(profile, m).s < s) lo = m; else hi = m; }
  return hi;
}

/** The path swept, segment by segment: clear, or its first contact in time; the least clearance and the profile along it. */
export function sweepTimed(tree: JointTree, links: readonly SweepLink[], path: TimedPath, o: { maxSamples?: number } = {}): TimedSweep {
  const segments = timePath(tree, path), clearanceProfile: [number, number][] = [], skipped: SweepResult['skipped'] = [];
  let min: TimedSweep['minClearance'] = null, samples = 0;
  for (let k = 0; k < segments.length; k++) {
    const g = segments[k], trace: [number, number][] = [];
    if (!g.profile) continue;
    const r = sweepPath(tree, links, g.from, g.to, { tolerance: CCD_TOLERANCE, trace, ...(o.maxSamples ? { maxSamples: o.maxSamples } : {}) });
    samples += r.samples;
    for (const s of r.skipped) if (!skipped.some(x => x.links[0] === s.links[0] && x.links[1] === s.links[1])) skipped.push(s);
    for (const [s, mm] of trace) clearanceProfile.push([g.t0 + timeAt(g.profile, s), mm]);
    if (r.minClearance && (!min || r.minClearance.mm < min.mm)) min = { mm: r.minClearance.mm, t: g.t0 + timeAt(g.profile, r.minClearance.s), links: r.minClearance.links };
    if (r.contact) return { clear: false, toi: g.t0 + timeAt(g.profile, r.contact.s), segment: k, links: r.contact.links, values: r.contact.values, minClearance: min, clearanceProfile, segments, samples, skipped };
  }
  return { clear: true, minClearance: min, clearanceProfile, segments, samples, skipped };
}
