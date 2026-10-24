// URDF export (RM4, O17): the joint tree (RM1) as a URDF robot, its links' inertia (RM3), meshes in each link's frame.
// Conventions (the URDF spec; onshape-to-robot):
//   - one <link> a link, the base link the root; a joint chain's dummy links between (a tiny mass and inertia, so
//     simulators that take a massless moving link as static do not);
//   - each <joint>'s origin is the child link's frame in the parent link's, at the solved pose (every value 0); its
//     axis in the child frame (Z for a moving joint: the link frame has Z on the axis, RM3);
//   - <inertial>: mass (kg), the centre of mass (m) and the inertia about it (kg·m²), in the link frame;
//   - <visual>: the part's tessellation and <collision>: its convex hull, both binary STL in metres in the link frame;
//   - a gear follower: <mimic joint multiplier offset>; loops cannot be written (a tree format): left out, noted.
// What URDF cannot hold is refused, typed: an unsupported motion, bad or missing limits (a revolute or prismatic joint
// needs lower, upper, effort and velocity), a link whose inertia fails its checks, a part with no hull.
import { convexHull, encodeBinaryStl, HullError } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { rotationMatrix } from '../engine/placement';
import type { Joint, JointTree } from './joints';
import { linkFrames, type Frame, type LinkInertia, type Mat3, type V3 } from './inertia';
import { nativeLinkInertia, type NativeInertiaBasis } from './nativeInertia';
import { namer, type FrameCode } from './frames';

export const URDF_EXPORT_VERSION = 'barocss-urdf-v1';
/** A dummy link's mass (kg) and inertia (kg·m²): small enough to change nothing, not zero (a static link in PyBullet). */
export const DUMMY_MASS = 1e-9, DUMMY_INERTIA = 1e-15;
export type UrdfRefusal = 'MOTION_UNSUPPORTED' | 'LIMITS_BAD' | 'LIMITS_MISSING' | 'INERTIA' | 'NO_HULL' | 'EMPTY' | 'CAM_UNSUPPORTED' | FrameCode;
export interface UrdfPart { doc: StudioDoc; bodies: readonly BodyResult[]; position: readonly number[]; rotation: readonly number[] }
export interface UrdfFile { path: string; data: Uint8Array }
export type UrdfResult =
  | { ok: true; urdf: string; files: UrdfFile[]; names: { links: Record<string, string>; joints: Record<string, string> }; notes: string[]; frames: Map<string, { R: Mat3; o: V3 }> }
  | { ok: false; refusals: { code: UrdfRefusal; message: string }[] };

const mul = (a: Mat3, b: Mat3): Mat3 => { const r = new Array(9).fill(0) as Mat3; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]; return r; };
const tr = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const ap = (m: Mat3, v: readonly number[]): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const unit = (v: V3): V3 => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
const crossV = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** URDF's roll, pitch, yaw: R = Rz(yaw) · Ry(pitch) · Rx(roll). */
export function rpyOf(R: Mat3): V3 {
  const pitch = Math.atan2(-R[6], Math.hypot(R[7], R[8]));
  if (Math.abs(Math.cos(pitch)) < 1e-12) return [Math.atan2(-R[5], R[4]), pitch, 0];
  return [Math.atan2(R[7], R[8]), pitch, Math.atan2(R[3], R[0])];
}
/** URDF's numbers: shortest exact decimal (JavaScript's own), a rounding of zero as 0. */
export const num = (v: number) => (Math.abs(v) < 1e-15 ? '0' : String(v));
export const nums = (v: readonly number[]) => v.map(num).join(' ');
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** The exports' namer (robot/frames.ts, where the frames' names are checked against it). */
export { namer };

/** A dummy link's frame (world): at its joint's point, Z on the joint's axis, X the world's X square to it (else Y). */
function frameOnAxis(j: Joint): { R: Mat3; o: V3 } {
  const z = unit(j.axis), pick: V3 = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], along = pick[0] * z[0] + pick[1] * z[1] + pick[2] * z[2];
  const x = unit([pick[0] - along * z[0], pick[1] - along * z[1], pick[2] - along * z[2]]), y = crossV(z, x);
  return { R: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]], o: [...j.origin] as V3 };
}

/** What URDF and MJCF both write (RM4, RM5): each link's world frame at home, its inertia and its meshes; or the refusals. */
export interface RobotParts {
  world: Map<string, { R: Mat3; o: V3 }>; inertias: Map<string, LinkInertia>;
  meshes: Map<string, { visual: { positions: Float32Array; indices: Uint32Array }; hull: { positions: Float64Array; indices: Uint32Array } }>;
  notes: string[];
  /** Internal native-export provenance. A fallback keeps general export support; it is not byte-preservation proof. */
  nativeInertia: NativeInertiaBasis[];
  /** The tool and sensor frames (O12), each a fixed child of its link: its pose in the link frame (t mm) and in the world. */
  frames: { name: string; link: string; R: Mat3; t: V3; world: { R: Mat3; o: V3 } }[];
}
/** The tree with its cams left out (O24 a): each cam's follower a free joint, said so in the notes. */
export function withoutCams(tree: JointTree): { tree: JointTree; notes: string[] } {
  const cams = tree.joints.filter(j => j.cam);
  if (!cams.length) return { tree, notes: [] };
  return { tree: { ...tree, joints: tree.joints.map(j => (j.cam ? { ...j, mimic: undefined, cam: undefined } : j)) }, notes: cams.map(j => `${j.key} follows a cam (${j.cam!.mate}): left out — written as a free joint`) };
}
export function robotParts(tree: JointTree, partOf: (part: string) => UrdfPart | null): RobotParts | { refusals: { code: UrdfRefusal; message: string }[] } {
  const refusals: { code: UrdfRefusal; message: string }[] = [], notes: string[] = [], nativeInertia: NativeInertiaBasis[] = [];
  for (const p of tree.problems) {
    if (p.code === 'MOTION_UNSUPPORTED') refusals.push({ code: 'MOTION_UNSUPPORTED', message: p.message });
    else if (p.code === 'LIMITS_BAD') refusals.push({ code: 'LIMITS_BAD', message: p.message });
    // (O12: a frame on a part that is not there, or not a link, is refused — never written elsewhere or dropped.)
    else if (p.code.startsWith('FRAME_')) refusals.push({ code: p.code as FrameCode, message: p.message });
    else notes.push(p.message);
  }
  for (const j of tree.joints) {
    const l = j.limit;
    if ((j.type === 'revolute' || j.type === 'prismatic') && (l?.lower === undefined || l.upper === undefined || l.effort === undefined || l.velocity === undefined))
      refusals.push({ code: 'LIMITS_MISSING', message: `${j.key}: a ${j.type} joint needs lower, upper, effort and velocity (set_joints).` });
  }
  if (tree.links.length < 1) refusals.push({ code: 'EMPTY', message: 'the robot has no link' });
  // (O24 a: URDF's mimic and MJCF's joint equality are linear and quartic — a cam's lift is neither: refused, unless the
  // export leaves the cams out, withoutCams, each follower then a free joint and noted.)
  for (const j of tree.joints) if (j.cam) refusals.push({ code: 'CAM_UNSUPPORTED', message: `${j.key} follows a cam (${j.cam.mate}): the format has no cam coupling; export with leave_out: ["cam"] to write its follower as a free joint` });
  for (const l of tree.loops) notes.push(`${l.message} A tree format: the closure (${l.mates.join(', ')}) is not written.`);
  // Link frames: a part's in its coordinates (RM3), then into the world through its placement; a dummy's on its joint.
  const local = linkFrames(tree, p => partOf(p)), world = new Map<string, { R: Mat3; o: V3 }>(), inertias = new Map<string, LinkInertia>(), meshes: RobotParts['meshes'] = new Map();
  for (const l of tree.links) {
    if (l.part === null) { const j = tree.joints.find(x => x.child === l.id)!; world.set(l.id, frameOnAxis(j)); continue; }
    const part = partOf(l.part), F = local.get(l.id)!, P = (part ? rotationMatrix(part.rotation) : [1, 0, 0, 0, 1, 0, 0, 0, 1]) as Mat3, t = (part?.position ?? [0, 0, 0]) as V3;
    const o = ap(P, F.origin);
    world.set(l.id, { R: mul(P, F.R), o: [o[0] + t[0], o[1] + t[1], o[2] + t[2]] });
    const native = nativeLinkInertia(l.id, l.part, part?.doc ?? null, part?.bodies ?? [], F), li = native.inertia;
    nativeInertia.push(...native.basis); notes.push(...native.notes);
    inertias.set(l.id, li);
    for (const i of li.issues) if (i.code === 'NOT_SPD' || i.code === 'TRIANGLE' || i.code === 'NO_BODY') refusals.push({ code: 'INERTIA', message: `${l.name}: ${i.message}` });
      else if (i.code !== 'MATERIAL_ASSUMED') notes.push(`${l.name}: ${i.message}`);
    if (li.issues.some(i => i.code === 'MATERIAL_ASSUMED')) notes.push(`${l.name}: a body without a material, aluminium assumed for its mass.`);
    // The part's bodies into the link frame, in metres: a visual mesh, and its convex hull for collision.
    const visual = linkMesh(part?.bodies ?? [], F);
    if (visual.indices.length) {
      try { meshes.set(l.id, { visual, hull: convexHull(visual.positions) }); } catch (e) { if (e instanceof HullError) refusals.push({ code: 'NO_HULL', message: `${l.name}: ${e.message}` }); else throw e; }
    }
  }
  const frames: RobotParts['frames'] = [];
  for (const f of tree.frames ?? []) {
    const L = world.get(f.link)!, Lt = tr(L.R);
    frames.push({ name: f.name, link: f.link, R: mul(Lt, f.R), t: ap(Lt, [f.o[0] - L.o[0], f.o[1] - L.o[1], f.o[2] - L.o[2]]), world: { R: f.R, o: f.o } });
  }
  return refusals.length ? { refusals } : { world, inertias, meshes, notes, frames, nativeInertia };
}

/** The robot as a URDF document and its mesh files, or what refuses it. `partOf(part)`: a part's document, bodies (own coordinates) and placement. */
export function exportUrdf(tree: JointTree, partOf: (part: string) => UrdfPart | null, robotName: string): UrdfResult {
  const parts = robotParts(tree, partOf);
  if ('refusals' in parts) return { ok: false, refusals: parts.refusals };
  const { world, inertias, meshes, notes } = parts;
  const linkName = namer(), jointName = namer(), names = { links: {} as Record<string, string>, joints: {} as Record<string, string> };
  for (const l of tree.links) names.links[l.id] = linkName(l.id);
  for (const j of tree.joints) names.joints[j.key] = jointName(j.key);
  const frameNames = frameExportNames(parts.frames, linkName, jointName);
  if (!(frameNames instanceof Map)) return { ok: false, refusals: [frameNames] };
  const files: UrdfFile[] = [], out: string[] = [];
  out.push('<?xml version="1.0"?>', `<!-- ${URDF_EXPORT_VERSION}: barocss CAD Studio. SI units; each link's frame at its joint, Z on the axis; joint values 0 at the pose the mates solve to. -->`, `<robot name="${esc(robotName.replace(/[^A-Za-z0-9_-]/g, '_') || 'robot')}">`);
  for (const l of tree.links) {
    const n = names.links[l.id], li = inertias.get(l.id);
    out.push(`  <link name="${n}">`);
    if (li) {
      const I = li.inertia;
      out.push(`    <inertial>`, `      <origin xyz="${nums(li.comM)}" rpy="0 0 0"/>`, `      <mass value="${num(li.massKg)}"/>`,
        `      <inertia ixx="${num(I[0])}" ixy="${num(I[1])}" ixz="${num(I[2])}" iyy="${num(I[4])}" iyz="${num(I[5])}" izz="${num(I[8])}"/>`, `    </inertial>`);
    } else out.push(`    <inertial>`, `      <origin xyz="0 0 0" rpy="0 0 0"/>`, `      <mass value="${num(DUMMY_MASS)}"/>`, `      <inertia ixx="${num(DUMMY_INERTIA)}" ixy="0" ixz="0" iyy="${num(DUMMY_INERTIA)}" iyz="0" izz="${num(DUMMY_INERTIA)}"/>`, `    </inertial>`);
    const mesh = meshes.get(l.id);
    if (mesh) {
      files.push({ path: `meshes/${n}.stl`, data: encodeBinaryStl(mesh.visual.positions, mesh.visual.indices, `barocss ${n} visual (m)`) }, { path: `meshes/${n}_collision.stl`, data: encodeBinaryStl(mesh.hull.positions, mesh.hull.indices, `barocss ${n} convex hull (m)`) });
      out.push(`    <visual>`, `      <origin xyz="0 0 0" rpy="0 0 0"/>`, `      <geometry><mesh filename="meshes/${n}.stl"/></geometry>`, `    </visual>`,
        `    <collision>`, `      <origin xyz="0 0 0" rpy="0 0 0"/>`, `      <geometry><mesh filename="meshes/${n}_collision.stl"/></geometry>`, `    </collision>`);
    }
    out.push(`  </link>`);
  }
  for (const j of tree.joints) {
    const P = world.get(j.parent)!, C = world.get(j.child)!, R = mul(tr(P.R), C.R), t = ap(tr(P.R), [C.o[0] - P.o[0], C.o[1] - P.o[1], C.o[2] - P.o[2]]).map(v => v / 1000);
    const axis = ap(tr(C.R), j.axis).map(v => (Math.abs(v) < 1e-12 ? 0 : v));
    const type = j.type, l = j.limit;
    out.push(`  <joint name="${names.joints[j.key]}" type="${type}">`, `    <parent link="${names.links[j.parent]}"/>`, `    <child link="${names.links[j.child]}"/>`, `    <origin xyz="${nums(t)}" rpy="${nums(rpyOf(R))}"/>`);
    if (type !== 'fixed') out.push(`    <axis xyz="${nums(axis)}"/>`);
    // (Lengths in metres: a prismatic joint's limits and velocity from mm.)
    const k = type === 'prismatic' ? 1e-3 : 1;
    if (type === 'revolute' || type === 'prismatic') out.push(`    <limit lower="${num(l!.lower! * k)}" upper="${num(l!.upper! * k)}" effort="${num(l!.effort!)}" velocity="${num(l!.velocity! * k)}"/>`);
    else if (type === 'continuous' && l?.effort !== undefined && l.velocity !== undefined) out.push(`    <limit effort="${num(l.effort)}" velocity="${num(l.velocity)}"/>`);
    if (j.mimic) out.push(`    <mimic joint="${names.joints[j.mimic.joint]}" multiplier="${num(j.mimic.multiplier)}" offset="${num(j.mimic.offset)}"/>`);
    out.push(`  </joint>`);
  }
  // (O12: each frame a massless link — the ROS-Industrial tool0 convention — on a fixed joint at its pose in its link's frame.)
  for (const f of parts.frames) {
    const n = frameNames.get(f.name)!;
    out.push(`  <link name="${n.link}"/>`, `  <joint name="${n.joint}" type="fixed">`, `    <parent link="${names.links[f.link]}"/>`, `    <child link="${n.link}"/>`, `    <origin xyz="${nums(f.t.map(v => v / 1000))}" rpy="${nums(rpyOf(f.R))}"/>`, `  </joint>`);
  }
  out.push('</robot>', '');
  return { ok: true, urdf: out.join('\n'), files, names, notes, frames: world };
}

/**
 * Each frame's link and fixed-joint names in an export (the links' and joints' namers, after the links and joints), or the
 * refusal when one does not come out as the frame's own name — a clash the tree's check cannot see (USD's root prim).
 */
export function frameExportNames(frames: RobotParts['frames'], linkName: (raw: string) => string, jointName: (raw: string) => string): Map<string, { link: string; joint: string }> | { code: 'FRAME_NAME'; message: string } {
  const out = new Map<string, { link: string; joint: string }>();
  for (const f of frames) {
    const link = linkName(f.name), joint = jointName(`${f.name}_fixed`);
    if (link !== f.name || joint !== `${f.name}_fixed`) return { code: 'FRAME_NAME', message: `[FRAME_NAME] "${f.name}" is taken in this export (it would be written ${link === f.name ? `with joint ${joint}` : `as ${link}`}): name the frame differently` };
    out.set(f.name, { link, joint });
  }
  return out;
}
/** A part's bodies merged into one mesh in a link frame, metres. */
function linkMesh(bodies: readonly BodyResult[], F: Frame): { positions: Float32Array; indices: Uint32Array } {
  let nv = 0, ni = 0;
  for (const b of bodies) { nv += b.mesh.positions.length; ni += b.mesh.indices.length; }
  const positions = new Float32Array(nv), indices = new Uint32Array(ni), Rt = tr(F.R);
  let vo = 0, io = 0;
  for (const b of bodies) {
    const p = b.mesh.positions, base = vo / 3;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i] - F.origin[0], y = p[i + 1] - F.origin[1], z = p[i + 2] - F.origin[2];
      positions[vo++] = (Rt[0] * x + Rt[1] * y + Rt[2] * z) / 1000; positions[vo++] = (Rt[3] * x + Rt[4] * y + Rt[5] * z) / 1000; positions[vo++] = (Rt[6] * x + Rt[7] * y + Rt[8] * z) / 1000;
    }
    for (const k of b.mesh.indices) indices[io++] = k + base;
  }
  return { positions, indices };
}
