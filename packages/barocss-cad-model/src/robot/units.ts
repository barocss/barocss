// Public robot values and latest stored settings use degrees, mm and N·mm; solvers use radians, mm and N·m.
import type { Joint, JointSettings, JointTree, JointType } from './joints';
import type { MoveLimits } from './dynamics';
import type { CamLift } from './cam';

const DEG = Math.PI / 180;
const turns = (type: JointType | undefined) => type === 'revolute' || type === 'continuous';
const scaleIn = (tree: JointTree, key: string) => turns(tree.joints.find(j => j.key === key)?.type) ? DEG : 1;

/** Public degrees/mm as solver radians/mm. Unknown keys remain available to the caller's typed refusal. */
export const jointValuesIn = (tree: JointTree, values: Readonly<Record<string, number>>): Record<string, number> =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value * scaleIn(tree, key)]));

/** Solver radians/mm as public degrees/mm, using the established nine-decimal reply precision. */
export const jointValuesOut = (tree: JointTree, values: Readonly<Record<string, number>>): Record<string, number> =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Math.round(value / scaleIn(tree, key) * 1e9) / 1e9 + 0]));

function settingsScaled(settings: JointSettings, angle: number, effort: number): JointSettings {
  return {
    ...(settings.lower !== undefined ? { lower: settings.lower * angle } : {}),
    ...(settings.upper !== undefined ? { upper: settings.upper * angle } : {}),
    ...(settings.velocity !== undefined ? { velocity: settings.velocity * angle } : {}),
    ...(settings.effort !== undefined ? { effort: settings.effort * effort } : {}),
  };
}

/** Latest stored/public settings as solver settings. The solved joint type supplies the units. */
export const jointSettingsIn = (type: JointType, settings: JointSettings): JointSettings =>
  settingsScaled(settings, turns(type) ? DEG : 1, turns(type) ? 1e-3 : 1);

/** Solver settings as latest stored/public settings. Slides keep their force in N. */
export const jointSettingsOut = (type: JointType, settings: JointSettings): JointSettings =>
  settingsScaled(settings, turns(type) ? 1 / DEG : 1, turns(type) ? 1000 : 1);

/** Public per-joint velocity/acceleration/jerk limits as solver limits. */
export function moveLimitsIn(tree: JointTree, key: string, limits: MoveLimits): MoveLimits {
  const k = scaleIn(tree, key);
  return { velocity: limits.velocity * k, acceleration: limits.acceleration * k, ...(limits.jerk !== undefined ? { jerk: limits.jerk * k } : {}) };
}

/** Motion report kinematics in degrees/mm; force and time are projected by their separate public adapter. */
export function moveJointsOut<T extends { distance: number; v_peak: number; a_peak: number; j_peak: number }>(tree: JointTree, joints: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(joints).map(([key, j]) => {
    const k = scaleIn(tree, key);
    return [key, { ...j, distance: j.distance / k, v_peak: j.v_peak / k, a_peak: j.a_peak / k, j_peak: j.j_peak / k }];
  }));
}

/** Public cam geometry: points/radii in mm; arc spans in degrees. It is not a solver CamLift. */
export type PublicCamLift = Omit<CamLift, 'arcs'> & { arcs: { c: CamLift['arcs'][number]['c']; r: number; from: number; width: number }[] };
export type PublicJoint = Omit<Joint, 'cam'> & { cam?: PublicCamLift };
export type PublicJointTree = Omit<JointTree, 'joints'> & { joints: PublicJoint[] };

/** A detached public tree projection. Internal geometry, couplings and solver inputs are not mutated. */
export function jointTreeOut(tree: JointTree): PublicJointTree {
  const ratioOut = (leader: string, follower: string, ratio: number) => ratio * scaleIn(tree, leader) / scaleIn(tree, follower);
  return {
    ...tree,
    joints: tree.joints.map(j => ({
      ...j,
      ...(j.limit ? { limit: jointSettingsOut(j.type, j.limit) } : {}),
      ...(j.mimic ? { mimic: { ...j.mimic, multiplier: ratioOut(j.mimic.joint, j.key, j.mimic.multiplier), offset: j.mimic.offset / scaleIn(tree, j.key) } } : {}),
      ...(j.cam ? { cam: { ...j.cam, arcs: j.cam.arcs.map(a => ({ ...a, from: a.from / DEG, width: a.width / DEG })) } } : {}),
    })),
    couplings: tree.couplings.map(c => ({ ...c, multiplier: ratioOut(c.leader, c.follower, c.multiplier) })),
    ...(tree.cams ? { cams: tree.cams.map(c => ({ ...c, ...(c.multiplier !== undefined ? { multiplier: ratioOut(c.leader, c.follower, c.multiplier) } : {}) })) } : {}),
  };
}
