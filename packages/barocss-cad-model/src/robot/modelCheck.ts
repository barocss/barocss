// Reading SDF and USD back (RM9c, O62): our own readers of what RM9c writes, into one model — each link's frame at the
// pose the mates solve to (m), its mass, centre of mass and inertia in its frame; each joint's type, parent and child,
// axis in the child frame, limits and gear coupling — and that model's forward kinematics in the files' own terms:
// each child at its parent's pose times their relative frame at home, then its motion about its axis. A different
// composition from RM2's product of exponentials, so the two checked against each other test the exports. The
// external validators (usd-core's UsdPhysics parser, libsdformat) wait for the owner's go-ahead (O62).
import { parseXml, type XmlNode } from './urdfCheck';
import type { Mat3, V3 } from './inertia';
import { refusal } from '../engine/refusal';

export interface ModelLink { name: string; R: Mat3; o: V3; mass: number; com: V3; inertia: Mat3 }
export interface ModelJoint { name: string; type: string; parent: string; child: string; axis: V3; limit?: { lower?: number; upper?: number; effort?: number; velocity?: number }; mimic?: { joint: string; multiplier: number; offset: number } }
export interface RobotModel { links: ModelLink[]; joints: ModelJoint[]; closures: { name: string; a: string; b: string }[] }

const mul = (a: Mat3, b: Mat3): Mat3 => { const r = new Array(9).fill(0) as Mat3; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]; return r; };
const tr = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const ap = (m: Mat3, v: readonly number[]): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
/** R = Rz(yaw) · Ry(pitch) · Rx(roll) (URDF's and SDF's order). */
function fromRpy(r: number, p: number, y: number): Mat3 {
  const cr = Math.cos(r), sr = Math.sin(r), cp = Math.cos(p), sp = Math.sin(p), cy = Math.cos(y), sy = Math.sin(y);
  return [cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr, sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr, -sp, cp * sr, cp * cr];
}
/** A unit quaternion (w, x, y, z) as a rotation. */
export function fromQuat(w: number, x: number, y: number, z: number): Mat3 {
  const n = Math.hypot(w, x, y, z); w /= n; x /= n; y /= n; z /= n;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
}
/** Rotation about a unit axis by θ (Rodrigues). */
function about(a: V3, t: number): Mat3 {
  const c = Math.cos(t), s = Math.sin(t), v = 1 - c, [x, y, z] = a;
  return [c + x * x * v, x * y * v - z * s, x * z * v + y * s, y * x * v + z * s, c + y * y * v, y * z * v - x * s, z * x * v - y * s, z * y * v + x * s, c + z * z * v];
}

// ——— SDF
const kids = (n: XmlNode, name: string) => n.children.filter(c => c.name === name);
const kid = (n: XmlNode, name: string) => n.children.find(c => c.name === name);
const numsOf = (s: string | undefined, k: number, what: string): number[] => {
  const v = (s ?? '').trim().split(/\s+/).map(Number); if (v.length !== k || v.some(x => !Number.isFinite(x))) throw refusal('MODEL_READ', `${what}: ${k} numbers expected, got "${s}"`); return v;
};
const val = (n: XmlNode | undefined, what: string) => { const v = Number(n?.text); if (!n || !Number.isFinite(v)) throw refusal('MODEL_READ', `${what} is missing or not a number`); return v; };
const opt = (n: XmlNode | undefined) => (n && n.text !== undefined && Number.isFinite(Number(n.text)) ? Number(n.text) : undefined);

/** An SDF model as RM9c writes it (its links' poses in the model frame; joints at their child's frame). */
export function readSdf(text: string): RobotModel {
  const root = parseXml(text, { text: true });
  if (root.name !== 'sdf' || root.attrs.version !== '1.11') throw refusal('MODEL_READ', `not an SDF 1.11 document (<${root.name} version="${root.attrs.version}">)`);
  const model = kid(root, 'model'); if (!model) throw refusal('MODEL_READ', 'no <model>');
  const links: ModelLink[] = kids(model, 'link').map(l => {
    const pose = kid(l, 'pose'); if (pose?.attrs.relative_to !== '__model__') throw refusal('MODEL_READ', `link ${l.attrs.name}: its pose is not in the model frame`);
    const p = numsOf(pose.text, 6, `link ${l.attrs.name} pose`), inl = kid(l, 'inertial'), ip = kid(inl ?? l, 'pose'), I = kid(inl ?? l, 'inertia');
    const c = ip ? numsOf(ip.text, 6, `link ${l.attrs.name} inertial pose`) : [0, 0, 0, 0, 0, 0];
    if (c[3] || c[4] || c[5]) throw refusal('MODEL_READ', `link ${l.attrs.name}: an inertial frame turned from the link's is not read`);
    const g = (k: string) => val(kid(I!, k), `link ${l.attrs.name} ${k}`);
    const xx = g('ixx'), xy = g('ixy'), xz = g('ixz'), yy = g('iyy'), yz = g('iyz'), zz = g('izz');
    return { name: l.attrs.name, R: fromRpy(p[3], p[4], p[5]), o: [p[0], p[1], p[2]], mass: val(kid(inl!, 'mass'), `link ${l.attrs.name} mass`), com: [c[0], c[1], c[2]], inertia: [xx, xy, xz, xy, yy, yz, xz, yz, zz] };
  });
  const joints: ModelJoint[] = [], closures: RobotModel['closures'] = [];
  for (const j of kids(model, 'joint')) {
    const type = j.attrs.type, parent = kid(j, 'parent')?.text ?? '', child = kid(j, 'child')?.text ?? '', pose = numsOf(kid(j, 'pose')?.text, 6, `joint ${j.attrs.name} pose`);
    if (type === 'ball') { closures.push({ name: j.attrs.name, a: parent, b: child }); continue; }
    if (pose.some(v => v !== 0)) throw refusal('MODEL_READ', `joint ${j.attrs.name}: away from its child's frame`);
    const ax = kid(j, 'axis'), lim = ax && kid(ax, 'limit'), mim = ax && kid(ax, 'mimic');
    const axis = (ax ? numsOf(kid(ax, 'xyz')?.text, 3, `joint ${j.attrs.name} axis`) : [0, 0, 1]) as V3;
    joints.push({ name: j.attrs.name, type, parent, child, axis, ...(lim ? { limit: { lower: opt(kid(lim, 'lower')), upper: opt(kid(lim, 'upper')), effort: opt(kid(lim, 'effort')), velocity: opt(kid(lim, 'velocity')) } } : {}),
      ...(mim ? { mimic: { joint: mim.attrs.joint, multiplier: val(kid(mim, 'multiplier'), 'mimic multiplier'), offset: val(kid(mim, 'offset'), 'mimic offset') } } : {}) });
  }
  return { links, joints, closures };
}

// ——— USD (.usda, as RM9c writes it: one level of prims under the root, attributes one a line)
/** A .usda stage as RM9c writes it. */
export function readUsda(text: string): RobotModel {
  if (!text.startsWith('#usda 1.0')) throw refusal('MODEL_READ', 'not a .usda file');
  const head = /\(\s*([\s\S]*?)\n\)/.exec(text)?.[1] ?? '';
  if (!/metersPerUnit = 1\b/.test(head) || !/kilogramsPerUnit = 1\b/.test(head) || !/upAxis = "Z"/.test(head)) throw refusal('MODEL_READ', 'the stage is not in SI units with Z up');
  // (The root's direct children: `    def <Type> "<name>"` at four spaces, each to its `    }`.)
  const prims: { type: string; name: string; body: string }[] = [];
  for (const m of text.matchAll(/^ {4}def (\w+) "(\w+)"[\s\S]*?^ {4}\{\n([\s\S]*?)^ {4}\}$/gm)) prims.push({ type: m[1], name: m[2], body: m[3] });
  const attr = (body: string, name: string) => new RegExp(`^ {8}(?:uniform |custom )?\\w+(?:\\[\\])? ${name.replace(/:/g, ':')} = (.+)$`, 'm').exec(body)?.[1];
  const tupleOf = (s: string | undefined, k: number, what: string) => { const v = (s ?? '').replace(/[()]/g, '').split(',').map(Number); if (v.length !== k || v.some(x => !Number.isFinite(x))) throw refusal('MODEL_READ', `${what}: ${k} numbers expected, got ${s}`); return v; };
  const links: ModelLink[] = [], joints: ModelJoint[] = [], closures: RobotModel['closures'] = [];
  for (const p of prims) {
    if (p.type === 'Xform') {
      const M = tupleOf(attr(p.body, 'xformOp:transform')?.replace(/\)\s*,\s*\(/g, ', '), 16, `${p.name} transform`);
      const R: Mat3 = [M[0], M[4], M[8], M[1], M[5], M[9], M[2], M[6], M[10]];
      const d = tupleOf(attr(p.body, 'physics:diagonalInertia'), 3, `${p.name} diagonalInertia`), q = attr(p.body, 'physics:principalAxes'), A = q ? fromQuat(...(tupleOf(q, 4, 'principalAxes') as [number, number, number, number])) : [1, 0, 0, 0, 1, 0, 0, 0, 1] as Mat3;
      const inertia = mul(mul(A, [d[0], 0, 0, 0, d[1], 0, 0, 0, d[2]]), tr(A));
      const com = attr(p.body, 'physics:centerOfMass');
      links.push({ name: p.name, R, o: [M[12], M[13], M[14]], mass: Number(attr(p.body, 'physics:mass')), com: (com ? tupleOf(com, 3, 'centerOfMass') : [0, 0, 0]) as V3, inertia });
      continue;
    }
    const rel = (k: string) => new RegExp(`rel physics:${k} = </\\w+/(\\w+)>`).exec(p.body)?.[1] ?? '';
    if (p.type === 'PhysicsSphericalJoint') { closures.push({ name: p.name, a: rel('body0'), b: rel('body1') }); continue; }
    const type = p.type === 'PhysicsPrismaticJoint' ? 'prismatic' : p.type === 'PhysicsFixedJoint' ? 'fixed' : attr(p.body, 'barocss:continuous') === 'true' ? 'continuous' : 'revolute';
    if (tupleOf(attr(p.body, 'physics:localPos1'), 3, 'localPos1').some(v => v !== 0) || attr(p.body, 'physics:localRot1') !== '(1, 0, 0, 0)') throw refusal('MODEL_READ', `joint ${p.name}: away from its child's frame`);
    const k = type === 'prismatic' ? 1 : Math.PI / 180, lo = attr(p.body, 'physics:lowerLimit'), hi = attr(p.body, 'physics:upperLimit'), ef = attr(p.body, 'barocss:effort'), ve = attr(p.body, 'barocss:velocity'), mj = attr(p.body, 'barocss:mimicJoint');
    const limit = lo !== undefined || ef !== undefined || ve !== undefined ? { ...(lo !== undefined ? { lower: Number(lo) * k, upper: Number(hi) * k } : {}), ...(ef !== undefined ? { effort: Number(ef) } : {}), ...(ve !== undefined ? { velocity: Number(ve) } : {}) } : undefined;
    const axisTok = attr(p.body, 'physics:axis');
    joints.push({ name: p.name, type, parent: rel('body0'), child: rel('body1'), axis: axisTok === '"X"' ? [1, 0, 0] : axisTok === '"Y"' ? [0, 1, 0] : [0, 0, 1], ...(limit ? { limit } : {}),
      ...(mj ? { mimic: { joint: JSON.parse(mj), multiplier: Number(attr(p.body, 'barocss:mimicMultiplier')), offset: Number(attr(p.body, 'barocss:mimicOffset')) } } : {}) });
  }
  return { links, joints, closures };
}

/** Each link's frame at q (radians, metres; a follower from its leader), in the files' own terms. */
export function modelFk(model: RobotModel, q: Readonly<Record<string, number>>): Map<string, { R: Mat3; o: V3 }> {
  const byName = new Map(model.links.map(l => [l.name, l])), out = new Map<string, { R: Mat3; o: V3 }>(), parentOf = new Map(model.joints.map(j => [j.child, j]));
  const value = (j: ModelJoint): number => j.mimic ? j.mimic.multiplier * (q[j.mimic.joint] ?? 0) + j.mimic.offset : q[j.name] ?? 0;
  const pose = (name: string): { R: Mat3; o: V3 } => {
    const have = out.get(name); if (have) return have;
    const L = byName.get(name)!, j = parentOf.get(name);
    if (!j) { const r = { R: L.R, o: L.o }; out.set(name, r); return r; }
    const P0 = byName.get(j.parent)!, P = pose(j.parent), Rrel = mul(tr(P0.R), L.R), orel = ap(tr(P0.R), [L.o[0] - P0.o[0], L.o[1] - P0.o[1], L.o[2] - P0.o[2]]);
    const t = ap(P.R, orel);
    let R = mul(P.R, Rrel), o: V3 = [t[0] + P.o[0], t[1] + P.o[1], t[2] + P.o[2]];
    const v = value(j);
    if (j.type === 'prismatic') { const d = ap(R, j.axis); o = [o[0] + d[0] * v, o[1] + d[1] * v, o[2] + d[2] * v]; }
    else if (j.type !== 'fixed') R = mul(R, about(j.axis, v));
    const r = { R, o }; out.set(name, r); return r;
  };
  for (const l of model.links) pose(l.name);
  return out;
}
