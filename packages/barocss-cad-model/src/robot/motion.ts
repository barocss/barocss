// A robot's motions (RS2): a path through joint-space waypoints, timed as ccd's Check path times it (each segment one
// profile over the tightest joint, every joint starting and stopping together within its limits), and the pose it
// gives at a time. The studio's playback, Check path (sweepTimed) and the agent share these, so what plays is what
// was checked. A saved motion (`robot.motions`, by name) is in the document's units — degrees for a turning joint,
// mm for a sliding one (conventions §2); `timedPathOf` gives the radians path the kernel-side math takes.
import { at } from './profile';
import { timePath, timeSegments, type JointLimits, type TimedPath, type TimedSegment } from './ccd';
import type { Joint, JointTree } from './joints';
import { problem, refusal, type Problem } from '../engine/refusal';

/** A joint's limits along a saved motion: deg/s, deg/s², deg/s³ for a turning joint; mm/s, mm/s², mm/s³ for a slide. */
export interface MotionLimits { velocity: number; acceleration: number; jerk?: number }
/** A saved motion: its waypoints' joint values by key (absent: 0), its profile, and its limits by key (`default`: the rest). */
export interface MotionPath { waypoints: Record<string, number>[]; profile?: 'trapezoid' | 's-curve'; limits?: Record<string, MotionLimits> }
/** A named motion, as the robot settings keep it. */
export interface Motion { name: string; path: MotionPath }

const DEG = Math.PI / 180;
const turns = (j: Joint | undefined) => j?.type === 'revolute' || j?.type === 'continuous';

/** The joint values at time `t` (s, clamped to the path's span) along a timed path: driven joints only (FK adds followers). */
export function poseAt(tree: JointTree, path: TimedPath, t: number): Record<string, number> {
  return valuesAt(segmentsOf(tree, path), t);
}
/** How long a timed path takes (s), timed as poseAt and sweepTimed time it, over the joints its waypoints name. */
export function duration(path: TimedPath): number {
  const keys = [...new Set(path.waypoints.flatMap(w => Object.keys(w)))], segs = timeSegments(keys, path), last = segs[segs.length - 1];
  return last ? last.t0 + last.duration : 0;
}

// (The timing of a path, once per path object: playback asks poseAt every frame.)
const timed = new WeakMap<TimedPath, { tree: JointTree; segments: TimedSegment[] }>();
function segmentsOf(tree: JointTree, path: TimedPath): TimedSegment[] {
  const had = timed.get(path); if (had && had.tree === tree) return had.segments;
  const segments = timePath(tree, path); timed.set(path, { tree, segments }); return segments;
}
function valuesAt(segments: readonly TimedSegment[], t: number): Record<string, number> {
  if (!segments.length) return {};
  let k = 0;
  while (k + 1 < segments.length && t >= segments[k].t0 + segments[k].duration) k++;
  const g = segments[k], local = Math.min(Math.max(t - g.t0, 0), g.duration), s = g.profile ? (local >= g.duration ? 1 : at(g.profile, local).s) : 1, out: Record<string, number> = {};
  for (const key of new Set([...Object.keys(g.from), ...Object.keys(g.to)])) { const a = g.from[key] ?? 0; out[key] = a + s * ((g.to[key] ?? 0) - a); }
  return out;
}

/**
 * What is wrong with a timed path on this robot: a key that is no joint (JOINT_UNKNOWN) or a gear follower's
 * (JOINT_MIMIC, it follows its leader), a waypoint past a joint's lower or upper (JOINT_LIMIT: the straight segments
 * between waypoints inside the limits stay inside), or limits missing for a joint that moves (LIMITS_MISSING).
 */
export function checkPath(tree: JointTree, path: TimedPath): Problem[] {
  const byKey = new Map(tree.joints.map(j => [j.key, j])), out: Problem[] = [];
  if (path.waypoints.length < 2) return [problem('PATH_TOO_SHORT', 'a path needs at least two waypoints')];
  for (const [i, w] of path.waypoints.entries()) for (const [key, v] of Object.entries(w)) {
    const j = byKey.get(key);
    if (!j || j.type === 'fixed') { out.push(problem('JOINT_UNKNOWN', `waypoint ${i}: no moving joint ${key} (joints: ${tree.joints.filter(x => x.type !== 'fixed' && !x.mimic).map(x => x.key).join(', ') || 'none'})`)); continue; }
    if (j.mimic) { out.push(problem('JOINT_MIMIC', `waypoint ${i}: ${key} follows ${j.mimic.joint} (gears): give ${j.mimic.joint} instead`)); continue; }
    if ((j.limit?.lower !== undefined && v < j.limit.lower - 1e-12) || (j.limit?.upper !== undefined && v > j.limit.upper + 1e-12)) out.push(problem('JOINT_LIMIT', `waypoint ${i}: ${key} = ${v} is outside its limits ${j.limit?.lower ?? '−∞'} to ${j.limit?.upper ?? '∞'}`));
  }
  if (!out.length) try { timePath(tree, path); } catch (e) { if (e instanceof Error && /^\[LIMITS_(MISSING|BAD)\]/.test(e.message)) out.push(problem(e.message.startsWith('[LIMITS_BAD]') ? 'LIMITS_BAD' : 'LIMITS_MISSING', e.message.replace(/^\[\w+\] /, ''))); else throw e; }
  return out;
}

/** A saved motion as the timed path poseAt, duration and sweepTimed take: a turning joint's degrees as radians. */
export function timedPathOf(tree: JointTree, m: MotionPath): TimedPath {
  const byKey = new Map(tree.joints.map(j => [j.key, j]));
  const value = (key: string, v: number) => turns(byKey.get(key)) ? v * DEG : v;
  const limits: Record<string, JointLimits> = {};
  for (const [key, l] of Object.entries(m.limits ?? {})) { const k = key === 'default' ? 1 : value(key, 1); limits[key] = { v: l.velocity * k, a: l.acceleration * k, ...(l.jerk !== undefined ? { j: l.jerk * k } : {}) }; }
  return { waypoints: m.waypoints.map(w => Object.fromEntries(Object.entries(w).map(([key, v]) => [key, value(key, v)]))), profile: m.profile ?? 'trapezoid', limits };
}
/** A timed path (the studio's draft, in radians) as a saved motion, in degrees: "Save as motion". */
export function motionOf(tree: JointTree, p: TimedPath): MotionPath {
  const byKey = new Map(tree.joints.map(j => [j.key, j]));
  const value = (key: string, v: number) => turns(byKey.get(key)) ? v / DEG : v;
  const limits: Record<string, MotionLimits> = {};
  for (const [key, l] of Object.entries(p.limits)) { if (!l) continue; const k = key === 'default' ? 1 : value(key, 1); limits[key] = { velocity: l.v * k, acceleration: l.a * k, ...(l.j !== undefined ? { jerk: l.j * k } : {}) }; }
  return { waypoints: p.waypoints.map(w => Object.fromEntries(Object.entries(w).map(([key, v]) => [key, value(key, v)]))), profile: p.profile, ...(Object.keys(limits).length ? { limits } : {}) };
}

/** The motions as read from a document's robot settings (anything malformed dropped, the rest kept). */
export function readMotions(raw: unknown): Motion[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v), out: Motion[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object' || typeof (m as Motion).name !== 'string' || !(m as Motion).name.trim()) continue;
    const p = (m as Motion).path; if (!p || typeof p !== 'object' || !Array.isArray(p.waypoints)) continue;
    const waypoints = p.waypoints.filter(w => w && typeof w === 'object' && Object.values(w).every(finite)).map(w => ({ ...w }));
    const limits: Record<string, MotionLimits> = {};
    for (const [k, l] of Object.entries(p.limits && typeof p.limits === 'object' ? p.limits : {})) if (l && finite(l.velocity) && finite(l.acceleration)) limits[k] = { velocity: l.velocity, acceleration: l.acceleration, ...(finite(l.jerk) ? { jerk: l.jerk } : {}) };
    out.push({ name: (m as Motion).name, path: { waypoints, ...(p.profile === 's-curve' || p.profile === 'trapezoid' ? { profile: p.profile } : {}), ...(Object.keys(limits).length ? { limits } : {}) } });
  }
  return out.length ? out : undefined;
}
/** A robot's motion by name, or a refusal naming the ones there (MOTION_UNKNOWN). */
export function motionNamed(motions: readonly Motion[] | undefined, name: string): Motion {
  const m = motions?.find(x => x.name === name);
  if (!m) throw refusal('MOTION_UNKNOWN', `no motion ${name} (motions: ${(motions ?? []).map(x => x.name).join(', ') || 'none'})`);
  return m;
}
