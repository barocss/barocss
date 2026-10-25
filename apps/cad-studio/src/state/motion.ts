import type { JointLimits, TimedPath } from '@barocss/cad-model/robot/ccd';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import { duration, motionOf, poseAt, type MotionPath } from '@barocss/cad-model/robot/motion';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { refusal } from '@barocss/cad-model/engine/refusal';
import { motionPlaybackAt } from '@barocss/cad-model/robot/verbs';
import type { ValueStore } from './valueStore';

/**
 * A robot's motion played back: a timed path and its length. Open chains use the core's cached poseAt timing.
 * Closed paths use the shared Model RS6 continuation from the assembled pose through the preceding segment seams.
 */
export interface LoopMotionContext { doc: StudioDoc; tree: JointTree }
export interface Motion {
  path: TimedPath; duration: number;
  /** The frozen public path at the Model boundary; viewport and input stores remain radians/mm. */
  loop?: { context: LoopMotionContext; publicPath: MotionPath };
}

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
export function timedMotion(path: TimedPath, context?: LoopMotionContext): Motion {
  if (!context?.tree.loops.length) return { path, duration: duration(path) };
  for (const w of path.waypoints) for (const [key, value] of Object.entries(w)) {
    if (!Number.isFinite(value)) throw refusal('VALUE', `${key}: a motion value must be finite`);
  }
  // Convert only at the public Model boundary; its shared helper reuses the facade's validated continuation.
  const publicPath = motionOf(context.tree, path), result = motionPlaybackAt(context.doc, context.tree, publicPath);
  return { path, duration: result.duration, loop: { context, publicPath } };
}

/** One seek, with driver inputs separate from the closed values consumed by FK (native radians/mm, seconds). */
export function motionFrame(tree: JointTree, motion: Motion, t: number) {
  if (!Number.isFinite(t)) throw refusal('VALUE', 'a motion time must be finite seconds');
  const time = Math.min(motion.duration, Math.max(0, t));
  if (tree.loops.length) {
    if (!motion.loop || motion.loop.context.tree !== tree) throw refusal('LOOP_OPEN', 'the closed motion needs its current document and joint tree');
    const result = motionPlaybackAt(motion.loop.context.doc, tree, motion.loop.publicPath, time);
    return { time, drivers: result.values, values: result.closedValues };
  }
  const values = poseAt(tree, motion.path, time);
  return { time, drivers: values, values };
}

/** The viewport's pose: loop passives solved by the shared Model helper; open-chain FK still fills followers. */
export function motionPose(tree: JointTree, motion: Motion, t: number): Record<string, number> { return motionFrame(tree, motion, t).values; }

/** Compute before publishing: a refused seek changes neither displayed pose, driver inputs nor time. */
export function applyMotionFrame(tree: JointTree, motion: Motion, t: number, stores: {
  inputs: ValueStore<Record<string, number>>; pose: ValueStore<Record<string, number>>; time: ValueStore<number>;
}) {
  const frame = motionFrame(tree, motion, t);
  stores.inputs.set(frame.drivers); stores.pose.set(frame.values); stores.time.set(frame.time);
  return frame;
}

/** Studio has no closed-path sweep/CCD adapter in this slice. Never sweep the raw driver-only tree poses. */
export function refuseMotionSweep(tree: JointTree): void {
  if (tree.loops.length) throw refusal('LOOP_OPEN', 'Studio does not yet check contact along a closed motion');
}
