// SDF export (RM9c, O62): the joint tree (RM1) as an SDFormat 1.11 model, the same parts as URDF and MJCF (RM4, RM5;
// robotParts): each link's frame at its joint (Z on the axis), its inertia about its centre of mass (RM3), its mesh and
// convex hull as binary STL in metres.
//   - <link>: its <pose> in the model frame (SDF 1.7+ frame semantics; x y z roll pitch yaw, URDF's rpy order);
//     <inertial> with its own <pose> (the centre of mass) and the inertia tensor in the link frame;
//   - <joint>: its pose is the child link's frame (SDF's default: expressed in the child), so the axis is the child
//     frame's Z for a moving joint, `expressed_in` left at the joint frame; limits in radians or metres;
//   - a gear follower: <axis><mimic joint> with multiplier, offset and reference 0 (follower = m·(leader − 0) + offset);
//   - a loop (RM8): a graph is allowed in SDF, so its pin is a `ball` joint between its two links, at the pin.
// What SDF cannot hold is refused by robotParts, as for URDF.
import { encodeBinaryStl } from '@barocss/cad';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import type { Mat3, V3 } from '@barocss/cad-model/robot/inertia';
import { esc, namer, num, nums, robotParts, rpyOf, type UrdfFile, type UrdfPart, type UrdfRefusal } from '@barocss/cad-model/robot/urdf';
import type { MjcfClosure } from '@barocss/cad-model/robot/mjcf';

export const SDF_EXPORT_VERSION = 'barocss-sdf-v1';
export type SdfResult =
  | { ok: true; sdf: string; files: UrdfFile[]; names: { links: Record<string, string>; joints: Record<string, string> }; notes: string[]; frames: Map<string, { R: Mat3; o: V3 }> }
  | { ok: false; refusals: { code: UrdfRefusal; message: string }[] };
const tr = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const ap = (m: Mat3, v: readonly number[]): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

/** The robot as an SDF document and its mesh files, or what refuses it. */
export function exportSdf(tree: JointTree, partOf: (part: string) => UrdfPart | null, modelName: string, closures: readonly MjcfClosure[] = []): SdfResult {
  const parts = robotParts(tree, partOf);
  if ('refusals' in parts) return { ok: false, refusals: parts.refusals };
  const { world, inertias, meshes } = parts, notes = closures.length >= tree.loops.length ? parts.notes.filter(n => !/A tree format/.test(n)) : parts.notes;
  const linkName = namer(), jointName = namer(), names = { links: {} as Record<string, string>, joints: {} as Record<string, string> };
  for (const l of tree.links) names.links[l.id] = linkName(l.id);
  for (const j of tree.joints) names.joints[j.key] = jointName(j.key);
  const files: UrdfFile[] = [], out: string[] = [];
  out.push('<?xml version="1.0"?>', `<!-- ${SDF_EXPORT_VERSION}: barocss CAD Studio. SI units; each link's frame at its joint, Z on the axis; joint values 0 at the pose the mates solve to. -->`,
    '<sdf version="1.11">', `  <model name="${esc(modelName.replace(/[^A-Za-z0-9_-]/g, '_') || 'robot')}">`);
  for (const l of tree.links) {
    const n = names.links[l.id], F = world.get(l.id)!, li = inertias.get(l.id), m = meshes.get(l.id);
    out.push(`    <link name="${n}">`, `      <pose relative_to="__model__">${nums(F.o.map(v => v / 1000))} ${nums(rpyOf(F.R))}</pose>`);
    if (li) {
      const I = li.inertia;
      out.push('      <inertial>', `        <pose>${nums(li.comM)} 0 0 0</pose>`, `        <mass>${num(li.massKg)}</mass>`,
        `        <inertia><ixx>${num(I[0])}</ixx><ixy>${num(I[1])}</ixy><ixz>${num(I[2])}</ixz><iyy>${num(I[4])}</iyy><iyz>${num(I[5])}</iyz><izz>${num(I[8])}</izz></inertia>`, '      </inertial>');
    } else out.push('      <inertial>', '        <mass>1e-9</mass>', '        <inertia><ixx>1e-15</ixx><ixy>0</ixy><ixz>0</ixz><iyy>1e-15</iyy><iyz>0</iyz><izz>1e-15</izz></inertia>', '      </inertial>');
    if (m) {
      files.push({ path: `meshes/${n}.stl`, data: encodeBinaryStl(m.visual.positions, m.visual.indices, `barocss ${n} visual (m)`) }, { path: `meshes/${n}_collision.stl`, data: encodeBinaryStl(m.hull.positions, m.hull.indices, `barocss ${n} convex hull (m)`) });
      out.push(`      <visual name="visual"><geometry><mesh><uri>meshes/${n}.stl</uri></mesh></geometry></visual>`, `      <collision name="collision"><geometry><mesh><uri>meshes/${n}_collision.stl</uri></mesh></geometry></collision>`);
    }
    out.push('    </link>');
  }
  for (const j of tree.joints) {
    const C = world.get(j.child)!, axis = ap(tr(C.R), j.axis).map(v => (Math.abs(v) < 1e-12 ? 0 : v)), l = j.limit, k = j.type === 'prismatic' ? 1e-3 : 1;
    out.push(`    <joint name="${names.joints[j.key]}" type="${j.type}">`, `      <parent>${names.links[j.parent]}</parent>`, `      <child>${names.links[j.child]}</child>`, '      <pose>0 0 0 0 0 0</pose>');
    if (j.type !== 'fixed') {
      const limit = j.type === 'continuous'
        ? `<limit>${l?.effort !== undefined ? `<effort>${num(l.effort)}</effort>` : ''}${l?.velocity !== undefined ? `<velocity>${num(l.velocity)}</velocity>` : ''}</limit>`
        : `<limit><lower>${num(l!.lower! * k)}</lower><upper>${num(l!.upper! * k)}</upper><effort>${num(l!.effort!)}</effort><velocity>${num(l!.velocity! * k)}</velocity></limit>`;
      const mimic = j.mimic ? `<mimic joint="${names.joints[j.mimic.joint]}"><multiplier>${num(j.mimic.multiplier)}</multiplier><offset>${num(j.mimic.offset * k)}</offset><reference>0</reference></mimic>` : '';
      out.push(`      <axis><xyz>${nums(axis)}</xyz>${limit}${mimic}</axis>`);
    }
    out.push('    </joint>');
  }
  // (RM8: a loop's pin, a ball joint in b's frame at the pin, closing the graph.)
  for (const c of closures) {
    const F = world.get(c.b)!, at = ap(tr(F.R), [c.point[0] - F.o[0], c.point[1] - F.o[1], c.point[2] - F.o[2]]).map(v => v / 1000);
    out.push(`    <joint name="loop_${names.links[c.a]}_${names.links[c.b]}" type="ball">`, `      <parent>${names.links[c.a]}</parent>`, `      <child>${names.links[c.b]}</child>`, `      <pose>${nums(at)} 0 0 0</pose>`, '    </joint>');
  }
  out.push('  </model>', '</sdf>', '');
  return { ok: true, sdf: out.join('\n'), files, names, notes, frames: world };
}
