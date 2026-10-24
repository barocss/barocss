// RS5 (cad-model's facade): an assembly read as a robot — its joint tree, a pose, a path checked for collisions, its
// inertia and gravity torques, and the four exports — as an immutable object over the same StudioDoc. Its verbs carry
// the v2 `assembly` actions' names (api-conventions §12): joints, set_joints, pose, sweep, inertia, gravity, urdf, mjcf;
// each reply is the agent's tool's, byte for byte (./robotCore). Joint values go in as the facade's units (§2): degrees
// for a turning joint, mm for a slide; the replies are the tools' own (their `values` the core's: radians, mm).
import { refuse } from '@barocss/cad/api';
import type { StudioDoc } from '../engine/doc';
import type { JointSettings } from '../robot/joints';
import { coreValues, gravityOf, inertiaOf, jointsOf, mjcfOf, poseOf, sdfOf, sweepOf, treeOf, urdfOf, usdOf, withJoints } from './robotCore';

export class Robot {
  readonly #doc: StudioDoc;
  constructor(doc: StudioDoc) { this.#doc = doc; }

  /** The plain document (a copy): the assembly's, robot settings and all. */
  get doc(): StudioDoc { return structuredClone(this.#doc); }

  /** `assembly.joints` (get_joints): the assembly as links and joints from its base link. */
  joints() { return jointsOf(this.#doc); }

  /** `assembly.set_joints`: the base link and joints' limits and ratings (null removes one's) — a new robot. */
  setJoints(o: { base?: string; joints?: Record<string, Partial<JointSettings> | null> }): Robot { return new Robot(withJoints(this.#doc, o)); }

  /** `assembly.pose` (forward_kinematics): where each link and frame is at joint values (degrees, or mm for a slide). */
  pose(values: Readonly<Record<string, number>> = {}) { return poseOf(this.#doc, coreValues(treeOf(this.#doc), values)); }

  /** A path through waypoints (each `{ joint: value }`, degrees or mm), to check for collisions. */
  path(waypoints: readonly Readonly<Record<string, number>>[]): RobotPath {
    if (!Array.isArray(waypoints) || waypoints.length < 2) throw refuse('VALUE', 'a path goes through at least two waypoints');
    return new RobotPath(this.#doc, waypoints.map(w => ({ ...w })));
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

/** A path through waypoints: each segment between two of them checked for collisions. (Timed playback, poseAt, comes with RS2.) */
export class RobotPath {
  readonly #doc: StudioDoc;
  readonly waypoints: readonly Readonly<Record<string, number>>[];
  constructor(doc: StudioDoc, waypoints: readonly Readonly<Record<string, number>>[]) { this.#doc = doc; this.waypoints = waypoints; }

  /** `assembly.sweep` (sweep_path) between each two waypoints in turn: one reply a segment. */
  check() {
    const tree = treeOf(this.#doc), w = this.waypoints.map(v => coreValues(tree, v));
    return w.slice(1).map((to, k) => sweepOf(this.#doc, w[k], to));
  }
}
