import { timePath, type JointLimits, type TimedPath, type TimedSegment } from '@barocss/cad-model/robot/ccd';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import { at } from '@barocss/cad-model/robot/profile';

/**
 * A robot's motion played back (RS2): a timed path — what Check path sweeps (RM6, RM9a) — and the pose at a time along it.
 * The path is timed once (its segments, each one's trapezoid within the joints' limits); each frame only reads the pose
 * at t from them. (The core's `poseAt(tree, path, t)` and `duration(path)`, the outer lane's, take this one's place when
 * they land; the path object is the same.)
 */
export interface Motion { path: TimedPath; segments: TimedSegment[]; duration: number }

/** Each moving joint's limits as Check path takes them: its velocity limit, else 1 rad/s (100 mm/s), named in `assumed`;
 *  twice that per second's acceleration. */
export function pathLimits(tree: JointTree): { limits: Record<string, JointLimits>; assumed: string[] } {
  const limits: Record<string, JointLimits> = {}, assumed: string[] = [];
  for (const j of tree.joints) {
    if (j.type === 'fixed' || j.mimic) continue;
    const v = j.limit?.velocity ?? (j.type === 'prismatic' ? 100 : 1);
    if (j.limit?.velocity === undefined) assumed.push(j.key);
    limits[j.key] = { v, a: 2 * v };
  }
  return { limits, assumed };
}

/** The draft motion, unsaved: from home through the waypoints recorded to the pose shown, as Check path goes. */
export function draftPath(tree: JointTree, waypoints: readonly Readonly<Record<string, number>>[], pose: Readonly<Record<string, number>>): TimedPath {
  return { waypoints: [{}, ...waypoints, pose], profile: 'trapezoid', limits: pathLimits(tree).limits };
}

/** A path timed to play: its segments and its length (s). */
export function timedMotion(tree: JointTree, path: TimedPath): Motion {
  const segments = timePath(tree, path), last = segments[segments.length - 1];
  return { path, segments, duration: last ? last.t0 + last.duration : 0 };
}

/** The pose at t (s, clamped to the motion): each joint from its segment's start to its end by the segment's progress. */
export function motionPose(motion: Motion, t: number): Record<string, number> {
  const segs = motion.segments;
  let k = 0;
  while (k + 1 < segs.length && t > segs[k].t0 + segs[k].duration) k++;
  const g = segs[k], out: Record<string, number> = {};
  if (!g) return out;
  const s = g.profile ? at(g.profile, Math.min(g.duration, Math.max(0, t - g.t0))).s : 1;
  for (const key in g.from) out[key] = g.from[key];
  for (const key in g.to) { const a = g.from[key] ?? 0; out[key] = a + (g.to[key] - a) * s; }
  for (const key in g.from) if (!(key in g.to)) out[key] = g.from[key] * (1 - s);
  return out;
}
