// MJCF export (RM5, O18): the same robot as the URDF (robotParts: link frames at the joints, RM3 inertials, meshes and
// convex hulls in metres) as a MuJoCo model. Bodies nest as the tree does, each at its link frame in its parent's
// (pos, and quat as w x y z); a moving joint is a hinge or a slide at the body's origin along its axis (Z), with a
// range when it has limits; a fixed one is no joint (the body welded to its parent); the base link is a body in the
// world without a joint (fixed). Each link has a visual geom (no contacts, group 1) and a collision geom on its hull
// (group 3); its explicit <inertial> wins over the geoms'. A gear follower is an equality: joint1 = multiplier ×
// joint2 (polycoef "0 m 0 0 0"). Gravity −9.81 m/s² on Z; no damping, friction or actuators are invented — a passive
// model as the parts and their mates make it. Loops are not written (RM8: an equality closure).
import type { JointTree } from './joints';
import type { Mat3, V3 } from './inertia';
import { encodeBinaryStl } from '@barocss/cad';
import { esc, namer, num, nums, robotParts, type UrdfFile, type UrdfPart, type UrdfRefusal } from './urdf';

export const MJCF_EXPORT_VERSION = 'barocss-mjcf-v1';
export type MjcfResult =
  | { ok: true; xml: string; files: UrdfFile[]; names: { links: Record<string, string>; joints: Record<string, string> }; notes: string[]; frames: Map<string, { R: Mat3; o: V3 }> }
  | { ok: false; refusals: { code: UrdfRefusal; message: string }[] };

const mul = (a: Mat3, b: Mat3): Mat3 => { const r = new Array(9).fill(0) as Mat3; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]; return r; };
const tr = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const ap = (m: Mat3, v: readonly number[]): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
/** A rotation's unit quaternion, w x y z (w ≥ 0), by the largest of its four (Shepperd). */
export function quatOf(R: Mat3): [number, number, number, number] {
  const t = R[0] + R[4] + R[8];
  let q: [number, number, number, number];
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [s / 4, (R[7] - R[5]) / s, (R[2] - R[6]) / s, (R[3] - R[1]) / s]; }
  else if (R[0] > R[4] && R[0] > R[8]) { const s = Math.sqrt(1 + R[0] - R[4] - R[8]) * 2; q = [(R[7] - R[5]) / s, s / 4, (R[1] + R[3]) / s, (R[2] + R[6]) / s]; }
  else if (R[4] > R[8]) { const s = Math.sqrt(1 + R[4] - R[0] - R[8]) * 2; q = [(R[2] - R[6]) / s, (R[1] + R[3]) / s, s / 4, (R[5] + R[7]) / s]; }
  else { const s = Math.sqrt(1 + R[8] - R[0] - R[4]) * 2; q = [(R[3] - R[1]) / s, (R[2] + R[6]) / s, (R[5] + R[7]) / s, s / 4]; }
  const l = Math.hypot(...q), sign = q[0] < 0 ? -1 : 1;
  return q.map(x => (sign * x) / l) as [number, number, number, number];
}

/** The robot as an MJCF model and its mesh files, or what refuses it (the same refusals as URDF). */
export function exportMjcf(tree: JointTree, partOf: (part: string) => UrdfPart | null, modelName: string): MjcfResult {
  const parts = robotParts(tree, partOf);
  if ('refusals' in parts) return { ok: false, refusals: parts.refusals };
  const { world, inertias, meshes, notes } = parts;
  const linkName = namer(), jointName = namer(), names = { links: {} as Record<string, string>, joints: {} as Record<string, string> };
  for (const l of tree.links) names.links[l.id] = linkName(l.id);
  for (const j of tree.joints) names.joints[j.key] = jointName(j.key);
  const files: UrdfFile[] = [], assets: string[] = [];
  for (const l of tree.links) {
    const m = meshes.get(l.id); if (!m) continue;
    const n = names.links[l.id];
    files.push({ path: `meshes/${n}.stl`, data: encodeBinaryStl(m.visual.positions, m.visual.indices, `barocss ${n} visual (m)`) }, { path: `meshes/${n}_collision.stl`, data: encodeBinaryStl(m.hull.positions, m.hull.indices, `barocss ${n} convex hull (m)`) });
    assets.push(`    <mesh name="${n}" file="${n}.stl"/>`, `    <mesh name="${n}_collision" file="${n}_collision.stl"/>`);
  }
  const children = new Map<string, typeof tree.joints>();
  for (const j of tree.joints) (children.get(j.parent) ?? children.set(j.parent, []).get(j.parent)!).push(j);
  const body: string[] = [];
  const write = (link: string, depth: number, pos: V3, R: Mat3, joint?: (typeof tree.joints)[number]) => {
    const pad = '  '.repeat(depth), n = names.links[link], li = inertias.get(link), m = meshes.get(link);
    body.push(`${pad}<body name="${n}" pos="${nums(pos)}" quat="${nums(quatOf(R))}">`);
    if (li) { const I = li.inertia; body.push(`${pad}  <inertial pos="${nums(li.comM)}" mass="${num(li.massKg)}" fullinertia="${nums([I[0], I[4], I[8], I[1], I[2], I[5]])}"/>`); }
    else body.push(`${pad}  <inertial pos="0 0 0" mass="1e-9" diaginertia="1e-15 1e-15 1e-15"/>`);
    if (joint && joint.type !== 'fixed') {
      const axis = ap(tr(world.get(link)!.R), joint.axis).map(v => (Math.abs(v) < 1e-12 ? 0 : v)), l = joint.limit, k = joint.type === 'prismatic' ? 1e-3 : 1;
      const range = l?.lower !== undefined && l.upper !== undefined && joint.type !== 'continuous' ? ` range="${num(l.lower * k)} ${num(l.upper * k)}"` : '';
      body.push(`${pad}  <joint name="${names.joints[joint.key]}" type="${joint.type === 'prismatic' ? 'slide' : 'hinge'}" pos="0 0 0" axis="${nums(axis)}"${range}/>`);
    }
    if (m) body.push(`${pad}  <geom name="${n}_visual" type="mesh" mesh="${n}" contype="0" conaffinity="0" group="1"/>`, `${pad}  <geom name="${n}_collision" type="mesh" mesh="${n}_collision" group="3"/>`);
    for (const j of children.get(link) ?? []) {
      const P = world.get(link)!, C = world.get(j.child)!;
      write(j.child, depth + 1, ap(tr(P.R), [C.o[0] - P.o[0], C.o[1] - P.o[1], C.o[2] - P.o[2]]).map(v => v / 1000) as V3, mul(tr(P.R), C.R), j);
    }
    body.push(`${pad}</body>`);
  };
  const root = world.get(tree.base)!;
  write(tree.base, 2, root.o.map(v => v / 1000) as V3, root.R);
  const equality = tree.joints.filter(j => j.mimic).map(j => `    <joint joint1="${names.joints[j.key]}" joint2="${names.joints[j.mimic!.joint]}" polycoef="${num(j.mimic!.offset)} ${num(j.mimic!.multiplier)} 0 0 0"/>`);
  const xml = ['<?xml version="1.0"?>', `<!-- ${MJCF_EXPORT_VERSION}: barocss CAD Studio. SI units; each body at its link frame (at its joint, Z on the axis); joint values 0 at the pose the mates solve to; a passive model (no damping, friction or actuators). -->`,
    `<mujoco model="${esc(modelName.replace(/[^A-Za-z0-9_-]/g, '_') || 'robot')}">`, '  <compiler angle="radian" meshdir="meshes" autolimits="true"/>', '  <option gravity="0 0 -9.81"/>',
    ...(assets.length ? ['  <asset>', ...assets, '  </asset>'] : []), '  <worldbody>', ...body, '  </worldbody>', ...(equality.length ? ['  <equality>', ...equality, '  </equality>'] : []), '</mujoco>', ''].join('\n');
  return { ok: true, xml, files, names, notes, frames: world };
}
