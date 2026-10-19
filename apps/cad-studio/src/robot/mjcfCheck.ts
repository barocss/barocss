// Reading an MJCF model back and checking its structure (RM5, O18), with our own XML reader (urdfCheck.ts): the
// rules MuJoCo's compiler enforces that this export can break, and forward kinematics in MuJoCo's composition — each
// body's pos and quat in its parent, then its joint's motion about its own axis at its own place — checked against
// RM2's. The gravity run (a 6R arm hanging stably) needs MuJoCo itself: scripts/mjcf-oracle.py, pending.
import { parseXml, type XmlNode } from './urdfCheck';

type V3 = [number, number, number];
export interface MjcfBody { name: string; parent: string | null; pos: V3; quat: [number, number, number, number]; joint?: { name: string; type: string; axis: V3; pos: V3; range?: [number, number] }; inertial?: { pos: V3; mass: number; I: number[] }; meshes: string[] }
export interface MjcfModel { name: string; bodies: MjcfBody[]; meshes: Map<string, string>; equality: { joint1: string; joint2: string; polycoef: number[] }[]; angle: string }
const JOINTS = new Set(['hinge', 'slide', 'ball', 'free']);

/** An MJCF model and every way it breaks the structure MuJoCo compiles (empty: none). */
export function readMjcf(text: string, files?: ReadonlySet<string>): { model: MjcfModel; issues: string[] } {
  const issues: string[] = [], root = parseXml(text);
  if (root.name !== 'mujoco') issues.push(`the root element is <${root.name}>, not <mujoco>`);
  const child = (n: XmlNode, name: string) => n.children.find(c => c.name === name);
  const vec = (s: string | undefined, k: number, what: string, d: number[]): number[] => {
    if (s === undefined) return d;
    const v = s.trim().split(/\s+/).map(Number);
    if (v.length !== k || v.some(x => !Number.isFinite(x))) { issues.push(`${what}: "${s}" is not ${k} numbers`); return d; }
    return v;
  };
  const compiler = child(root, 'compiler'), angle = compiler?.attrs.angle ?? 'degree', meshdir = compiler?.attrs.meshdir ?? '';
  if (angle !== 'radian') issues.push('<compiler angle> is not "radian": every angle here is in radians');
  const meshes = new Map<string, string>();
  for (const m of child(root, 'asset')?.children.filter(c => c.name === 'mesh') ?? []) {
    const name = m.attrs.name ?? '', file = m.attrs.file ?? '';
    if (meshes.has(name)) issues.push(`mesh ${name} twice`);
    meshes.set(name, meshdir ? `${meshdir}/${file}` : file);
    if (files && !files.has(meshes.get(name)!)) issues.push(`mesh ${name}: no file ${meshes.get(name)}`);
  }
  const wb = child(root, 'worldbody');
  if (!wb) issues.push('no <worldbody>');
  const bodies: MjcfBody[] = [];
  const walk = (n: XmlNode, parent: string | null) => {
    for (const b of n.children.filter(c => c.name === 'body')) {
      const name = b.attrs.name ?? '', q = vec(b.attrs.quat, 4, `${name} quat`, [1, 0, 0, 0]);
      if (!name) issues.push('a <body> has no name');
      if (Math.abs(Math.hypot(...q) - 1) > 1e-9) issues.push(`${name}: its quat is not a unit quaternion`);
      const js = b.children.filter(c => c.name === 'joint');
      if (js.length > 1) issues.push(`${name}: ${js.length} joints (one a body here)`);
      let joint: MjcfBody['joint'];
      if (js[0]) {
        const j = js[0], type = j.attrs.type ?? 'hinge', axis = vec(j.attrs.axis, 3, `${j.attrs.name} axis`, [0, 0, 1]) as V3, range = j.attrs.range ? vec(j.attrs.range, 2, `${j.attrs.name} range`, [0, 0]) as [number, number] : undefined;
        if (!JOINTS.has(type)) issues.push(`${j.attrs.name}: type "${type}" is not an MJCF joint type`);
        if (Math.abs(Math.hypot(...axis) - 1) > 1e-9) issues.push(`${j.attrs.name}: its axis is not a unit vector`);
        if (range && !(range[0] < range[1])) issues.push(`${j.attrs.name}: its range is not lower < upper`);
        joint = { name: j.attrs.name ?? '', type, axis, pos: vec(j.attrs.pos, 3, `${j.attrs.name} pos`, [0, 0, 0]) as V3, ...(range ? { range } : {}) };
      }
      const inn = child(b, 'inertial');
      let inertial: MjcfBody['inertial'];
      if (inn) {
        const mass = Number(inn.attrs.mass), full = inn.attrs.fullinertia ? vec(inn.attrs.fullinertia, 6, `${name} fullinertia`, []) : null, diag = inn.attrs.diaginertia ? vec(inn.attrs.diaginertia, 3, `${name} diaginertia`, []) : null;
        if (!(mass > 0)) issues.push(`${name}: mass ${inn.attrs.mass} is not above 0`);
        const I = full ? full : diag ? [diag[0], diag[1], diag[2], 0, 0, 0] : null;
        if (!I) issues.push(`${name}: <inertial> has neither fullinertia nor diaginertia`);
        else {
          // (fullinertia: ixx iyy izz ixy ixz iyz.) Positive definite and a triangle, as MuJoCo's compiler checks.
          const ev = eigenSym([I[0], I[3], I[4], I[3], I[1], I[5], I[4], I[5], I[2]]);
          if (!(ev[0] > 0)) issues.push(`${name}: its inertia is not positive definite`);
          if (ev[2] > ev[0] + ev[1] + 1e-9 * ev[2]) issues.push(`${name}: its principal moments break the triangle inequality`);
          inertial = { pos: vec(inn.attrs.pos, 3, `${name} inertial pos`, [0, 0, 0]) as V3, mass, I };
        }
      } else if (joint) issues.push(`${name}: a moving body without <inertial>`);
      const ms = b.children.filter(c => c.name === 'geom' && c.attrs.type === 'mesh').map(g => g.attrs.mesh ?? '');
      for (const m of ms) if (!meshes.has(m)) issues.push(`${name}: no mesh asset ${m}`);
      bodies.push({ name, parent, pos: vec(b.attrs.pos, 3, `${name} pos`, [0, 0, 0]) as V3, quat: q as [number, number, number, number], ...(joint ? { joint } : {}), ...(inertial ? { inertial } : {}), meshes: ms });
      walk(b, name);
    }
  };
  if (wb) walk(wb, null);
  const bodyNames = new Set<string>(), jointNames = new Set<string>();
  for (const b of bodies) { if (bodyNames.has(b.name)) issues.push(`body ${b.name} twice`); bodyNames.add(b.name); if (b.joint) { if (jointNames.has(b.joint.name)) issues.push(`joint ${b.joint.name} twice`); jointNames.add(b.joint.name); } }
  const equality = (child(root, 'equality')?.children.filter(c => c.name === 'joint') ?? []).map(e => ({ joint1: e.attrs.joint1 ?? '', joint2: e.attrs.joint2 ?? '', polycoef: vec(e.attrs.polycoef, 5, 'polycoef', [0, 1, 0, 0, 0]) }));
  for (const e of equality) for (const j of [e.joint1, e.joint2]) if (!jointNames.has(j)) issues.push(`equality: no joint ${j}`);
  return { model: { name: root.attrs.model ?? '', bodies, meshes, equality, angle }, issues };
}
/** A symmetric 3 × 3's eigenvalues, ascending (closed form). */
function eigenSym(a: number[]): V3 {
  const p1 = a[1] * a[1] + a[2] * a[2] + a[5] * a[5];
  if (p1 === 0) return [a[0], a[4], a[8]].sort((x, y) => x - y) as V3;
  const q = (a[0] + a[4] + a[8]) / 3, p = Math.sqrt(((a[0] - q) ** 2 + (a[4] - q) ** 2 + (a[8] - q) ** 2 + 2 * p1) / 6);
  const b = a.map((x, i) => (x - (i % 4 === 0 ? q : 0)) / p), r = (b[0] * (b[4] * b[8] - b[5] * b[7]) - b[1] * (b[3] * b[8] - b[5] * b[6]) + b[2] * (b[3] * b[7] - b[4] * b[6])) / 2;
  const phi = r <= -1 ? Math.PI / 3 : r >= 1 ? 0 : Math.acos(r) / 3, e1 = q + 2 * p * Math.cos(phi), e3 = q + 2 * p * Math.cos(phi + 2 * Math.PI / 3);
  return [e3, 3 * q - e1 - e3, e1];
}

type Pose = { R: number[]; t: V3 };
const quatMatrix = ([w, x, y, z]: readonly number[]): number[] => [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
const compose = (a: Pose, b: Pose): Pose => {
  const R = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) R[i * 3 + j] += a.R[i * 3 + k] * b.R[k * 3 + j];
  return { R, t: [0, 1, 2].map(i => a.R[i * 3] * b.t[0] + a.R[i * 3 + 1] * b.t[1] + a.R[i * 3 + 2] * b.t[2] + a.t[i]) as V3 };
};
/** A joint's motion in its body's frame: a turn about its axis through its pos, or a slide along it. */
function motion(j: NonNullable<MjcfBody['joint']>, q: number): Pose {
  if (j.type === 'slide') return { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [j.axis[0] * q, j.axis[1] * q, j.axis[2] * q] };
  if (j.type !== 'hinge') return { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
  const [x, y, z] = j.axis, c = Math.cos(q), s = Math.sin(q), v = 1 - c, p = j.pos;
  const R = [v * x * x + c, v * x * y - s * z, v * x * z + s * y, v * x * y + s * z, v * y * y + c, v * y * z - s * x, v * x * z - s * y, v * y * z + s * x, v * z * z + c];
  return { R, t: [0, 1, 2].map(i => p[i] - (R[i * 3] * p[0] + R[i * 3 + 1] * p[1] + R[i * 3 + 2] * p[2])) as V3 };
}
/** Each body's pose in the world (metres) at joint values `q` by joint name (an equality's joint1 from its joint2). */
export function mjcfFk(model: MjcfModel, q: Readonly<Record<string, number>>): Map<string, Pose> {
  const value = (name: string) => { const e = model.equality.find(x => x.joint1 === name); if (!e) return q[name] ?? 0; const v = q[e.joint2] ?? 0; return e.polycoef.reduce((s, c, k) => s + c * v ** k, 0); };
  const out = new Map<string, Pose>();
  for (const b of model.bodies) {
    const parent = b.parent ? out.get(b.parent)! : { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] as V3 };
    const at = compose(parent, { R: quatMatrix(b.quat), t: b.pos });
    out.set(b.name, b.joint ? compose(at, motion(b.joint, value(b.joint.name))) : at);
  }
  return out;
}
