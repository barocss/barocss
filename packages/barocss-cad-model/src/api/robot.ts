// RS5 (cad-model's facade): an assembly read as a robot — its joint tree, a pose, a path checked for collisions, its
// inertia and gravity torques, and the four exports — as an immutable object over the same StudioDoc. Its verbs carry
// the v2 `assembly` actions' names (api-conventions §12): joints, set_joints, pose, sweep, inertia, gravity, urdf, mjcf;
// each reply uses the agent's core tools (./robotCore). A path is RS2's motion: poseAt plays it in time. Pose joint
// values use the facade's units (§2), in and out: degrees for a turning joint, mm for a slide.
import { refuse } from '@barocss/cad/api';
import type { StudioDoc } from '../engine/doc';
import type { JointSettings } from '../robot/joints';
import { coreValues, durationOf, refuseLoop, gravityOf, inertiaOf, jointsOf, mjcfOf, motionOf, poseAtOf, poseOf, problemsOf, sdfOf, sweepOf, treeOf, urdfOf, usdOf, withJoints, withMotion } from './robotCore';
import type { MotionLimits, MotionPath } from '../robot/motion';

export class Robot {
  readonly #doc: StudioDoc;
  constructor(doc: StudioDoc) { this.#doc = doc; }

  /** The plain document (a copy): the assembly's, robot settings and all. */
  get doc(): StudioDoc { return structuredClone(this.#doc); }

  /** `assembly.joints`: the public tree, with turning limits/velocity in degrees and degree/s, effort in N·mm; slides in mm and N. */
  joints() { return jointsOf(this.#doc); }

  /** `assembly.set_joints`: store public degree/mm limits and ratings unchanged (null removes one's) — a new robot. */
  setJoints(o: { base?: string; joints?: Record<string, Partial<JointSettings> | null> }): Robot { return new Robot(withJoints(this.#doc, o)); }

  /** `assembly.pose` (forward_kinematics): each link and frame, with joint values in degrees (or mm for a slide), in and out. */
  pose(values: Readonly<Record<string, number>> = {}) { return poseOf(this.#doc, coreValues(treeOf(this.#doc), values)); }

  /**
   * A path through waypoints (each `{ joint: value }`, degrees or mm) — a motion as RS2 keeps one: its profile
   * (trapezoid unless s-curve) and each joint's limits (deg/s, deg/s² or mm/s, mm/s²; `default` for the rest) time it.
   */
  path(waypoints: readonly Readonly<Record<string, number>>[], o: { profile?: 'trapezoid' | 's-curve'; limits?: Record<string, MotionLimits> } = {}): RobotPath {
    if (!Array.isArray(waypoints) || waypoints.length < 2) throw refuse('VALUE', 'a path goes through at least two waypoints');
    return new RobotPath(this.#doc, { waypoints: waypoints.map(w => ({ ...w })), ...(o.profile ? { profile: o.profile } : {}), ...(o.limits ? { limits: structuredClone(o.limits) } : {}) });
  }

  /** A motion saved in the robot settings, by name, as a path. */
  motion(name: string): RobotPath { return new RobotPath(this.#doc, motionOf(this.#doc, name).path); }

  /** The robot with a path saved as a motion under a name (replacing one of that name) — a new robot. */
  withMotion(name: string, path: RobotPath): Robot {
    if (!(path instanceof RobotPath)) throw refuse('VALUE', 'withMotion takes a path (robot.path(waypoints, …))');
    return new Robot(withMotion(this.#doc, name, path.motion));
  }

  /** `assembly.inertia` (link_inertia): each link's mass, centre of mass and inertia. */
  inertia() { return inertiaOf(this.#doc); }

  /** `assembly.gravity` (gravity_torques): the static torque each joint holds at joint values (degrees, or mm), `g` in m/s². */
  gravity(values: Readonly<Record<string, number>> = {}, g?: readonly [number, number, number]) { return gravityOf(this.#doc, coreValues(treeOf(this.#doc), values), g); }

  /** `assembly.urdf` and `assembly.mjcf`: the robot as URDF or MJCF, checked — the tools' replies, each file's data beside it. */
  urdf(name = 'robot') { return urdfOf(this.#doc, name); }
  mjcf(name = 'robot') { return mjcfOf(this.#doc, name); }
  /** The robot as SDF and as USD (.usda), as the studio's Export menu writes them. */
  sdf(name = 'robot') { return sdfOf(this.#doc, name); }
  usd(name = 'robot') { return usdOf(this.#doc, name); }
}

/** A path through waypoints, as RS2 keeps a motion: checked for collisions segment by segment, and played in time (poseAt). */
export class RobotPath {
  readonly #doc: StudioDoc;
  readonly #motion: MotionPath;
  constructor(doc: StudioDoc, motion: MotionPath) { this.#doc = doc; this.#motion = motion; }

  /** The path as the robot settings keep it (a copy): its waypoints, profile and limits, in degrees and mm. */
  get motion(): MotionPath { return structuredClone(this.#motion); }
  get waypoints(): readonly Readonly<Record<string, number>>[] { return this.motion.waypoints; }

  /** `assembly.sweep` between each two waypoints: one reply per segment, contact joint values in degrees/mm. */
  check() {
    const tree = treeOf(this.#doc);
    refuseLoop(tree);
    const w = this.#motion.waypoints.map(v => coreValues(tree, v));
    return w.slice(1).map((to, k) => sweepOf(this.#doc, w[k], to));
  }

  /** What is wrong with the path on this robot (RS2's checkPath): unknown or following joints, limits passed or missing. */
  problems() { return problemsOf(this.#doc, this.#motion); }
  /** How long it takes (s), each segment one profile over its tightest joint. */
  duration(): number { return durationOf(this.#doc, this.#motion); }
  /** The joint values at time t (s), degrees and mm — what pose() takes; refused, typed, when the path has a problem. */
  poseAt(t: number): Record<string, number> { return poseAtOf(this.#doc, this.#motion, t); }
}
