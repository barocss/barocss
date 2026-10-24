import type { JointLimits, TimedPath } from '@barocss/cad-model/robot/ccd';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import { duration, poseAt } from '@barocss/cad-model/robot/motion';

/**
 * A robot's motion played back (RS2): a timed path — what Check path sweeps (RM6, RM9a) — and its length. The pose at a
 * time along it is the core's `poseAt` (robot/motion, the outer lane's), which times the path once per path object, so
 * a frame only reads the pose from it.
 */
export interface Motion { path: TimedPath; duration: number }

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

/** A path to play: the path and its length (s). */
export function timedMotion(path: TimedPath): Motion { return { path, duration: duration(path) }; }

/** The pose at t (s, clamped to the motion), driven joints only (FK adds the followers). */
export function motionPose(tree: JointTree, motion: Motion, t: number): Record<string, number> { return poseAt(tree, motion.path, t); }
