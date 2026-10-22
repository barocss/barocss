// Reading a URDF back and checking it against the URDF spec (RM4, O17): our own small XML reader (elements,
// attributes, comments, the declaration, the five entities), the robot model it holds, its structural rules, and its
// forward kinematics in URDF's own terms — each joint's origin, then its motion about its axis in the child frame —
// a different composition from RM2's product of exponentials, so the two checked against each other test the export.
// External checkers (check_urdf, MuJoCo, PyBullet) are test oracles outside the product (scripts/urdf-oracle.py).

export class XmlError extends Error { constructor(message: string, readonly at: number) { super(`XML at ${at}: ${message}`); this.name = 'XmlError'; } }
export interface XmlNode { name: string; attrs: Record<string, string>; children: XmlNode[]; /** Its text, trimmed (with `{ text: true }`: SDF keeps its values there). */ text?: string }
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescape = (s: string, at: number) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (_, e: string) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  if (!(e in ENTITIES)) throw new XmlError(`unknown entity &${e};`, at);
  return ENTITIES[e];
});

/** The document's root element (text between elements is ignored: URDF keeps everything in attributes; `{ text: true }`
 * keeps each element's own text, trimmed, entities resolved — RM9c's SDF reader). */
export function parseXml(text: string, o: { text?: boolean } = {}): XmlNode {
  let i = 0;
  const stack: XmlNode[] = [], top: XmlNode = { name: '#document', attrs: {}, children: [] };
  stack.push(top);
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt < 0) break;
    if (text.slice(i, lt).trim() && stack.length === 1) throw new XmlError('text outside the root element', i);
    if (o.text && stack.length > 1) { const t = text.slice(i, lt).trim(); if (t) { const n = stack[stack.length - 1]; n.text = (n.text ?? '') + unescape(t, i); } }
    i = lt;
    if (text.startsWith('<!--', i)) { const e = text.indexOf('-->', i + 4); if (e < 0) throw new XmlError('a comment is not closed', i); i = e + 3; continue; }
    if (text.startsWith('<?', i)) { const e = text.indexOf('?>', i + 2); if (e < 0) throw new XmlError('a declaration is not closed', i); i = e + 2; continue; }
    if (text.startsWith('<!', i)) throw new XmlError('DOCTYPE and CDATA are not read', i);
    if (text[i + 1] === '/') {
      const e = text.indexOf('>', i), name = text.slice(i + 2, e).trim(), open = stack.pop();
      if (!open || open.name !== name || stack.length < 1) throw new XmlError(`</${name}> closes ${open ? `<${open.name}>` : 'nothing'}`, i);
      i = e + 1; continue;
    }
    const m = /^<([A-Za-z_][\w.:-]*)((?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/.exec(text.slice(i));
    if (!m) throw new XmlError('a malformed tag', i);
    const node: XmlNode = { name: m[1], attrs: {}, children: [] };
    for (const a of m[2].matchAll(/([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      if (a[1] in node.attrs) throw new XmlError(`attribute ${a[1]} twice`, i);
      node.attrs[a[1]] = unescape(a[2] ?? a[3], i);
    }
    stack[stack.length - 1].children.push(node);
    if (!m[3]) stack.push(node);
    i += m[0].length;
  }
  if (stack.length !== 1) throw new XmlError(`<${stack[stack.length - 1].name}> is not closed`, text.length);
  if (top.children.length !== 1) throw new XmlError(`${top.children.length} root elements`, 0);
  return top.children[0];
}

type V3 = [number, number, number];
export interface UrdfLink { name: string; inertial?: { xyz: V3; rpy: V3; mass: number; I: [number, number, number, number, number, number] }; meshes: string[] }
export interface UrdfJoint { name: string; type: string; parent: string; child: string; xyz: V3; rpy: V3; axis: V3; limit?: { lower?: number; upper?: number; effort?: number; velocity?: number }; mimic?: { joint: string; multiplier: number; offset: number } }
export interface UrdfModel { name: string; links: UrdfLink[]; joints: UrdfJoint[] }
const TYPES = new Set(['revolute', 'continuous', 'prismatic', 'fixed', 'floating', 'planar']);

/** A URDF's robot, and every way it breaks the spec's structure (empty: none). */
export function readUrdf(text: string, files?: ReadonlySet<string>): { model: UrdfModel; issues: string[] } {
  const issues: string[] = [], root = parseXml(text);
  if (root.name !== 'robot') issues.push(`the root element is <${root.name}>, not <robot>`);
  if (!root.attrs.name) issues.push('<robot> has no name');
  const vec = (s: string | undefined, what: string, d: V3 = [0, 0, 0]): V3 => {
    if (s === undefined) return d;
    const v = s.trim().split(/\s+/).map(Number);
    if (v.length !== 3 || v.some(x => !Number.isFinite(x))) { issues.push(`${what}: "${s}" is not three numbers`); return d; }
    return v as V3;
  };
  const numAttr = (n: XmlNode | undefined, k: string, what: string): number | undefined => {
    const s = n?.attrs[k]; if (s === undefined) return undefined;
    const v = Number(s); if (!Number.isFinite(v)) { issues.push(`${what}: ${k}="${s}" is not a number`); return undefined; } return v;
  };
  const child = (n: XmlNode, name: string) => n.children.find(c => c.name === name);
  const links: UrdfLink[] = root.children.filter(c => c.name === 'link').map(l => {
    const name = l.attrs.name ?? ''; if (!name) issues.push('a <link> has no name');
    const inert = child(l, 'inertial'), meshes = l.children.filter(c => c.name === 'visual' || c.name === 'collision').flatMap(v => (child(v, 'geometry')?.children ?? []).filter(g => g.name === 'mesh').map(g => g.attrs.filename ?? ''));
    let inertial: UrdfLink['inertial'];
    if (inert) {
      const o = child(inert, 'origin'), m = numAttr(child(inert, 'mass'), 'value', `${name} mass`), I = child(inert, 'inertia');
      const ks = ['ixx', 'ixy', 'ixz', 'iyy', 'iyz', 'izz'].map(k => numAttr(I, k, `${name} inertia`));
      if (m === undefined || ks.some(x => x === undefined)) issues.push(`${name}: <inertial> needs <mass value> and <inertia ixx … izz>`);
      else inertial = { xyz: vec(o?.attrs.xyz, `${name} inertial xyz`), rpy: vec(o?.attrs.rpy, `${name} inertial rpy`), mass: m, I: ks as [number, number, number, number, number, number] };
    }
    return { name, ...(inertial ? { inertial } : {}), meshes };
  });
  const joints: UrdfJoint[] = root.children.filter(c => c.name === 'joint').map(j => {
    const name = j.attrs.name ?? '', type = j.attrs.type ?? '', o = child(j, 'origin'), lim = child(j, 'limit'), mim = child(j, 'mimic');
    if (!name) issues.push('a <joint> has no name');
    if (!TYPES.has(type)) issues.push(`${name}: type "${type}" is not a URDF joint type`);
    const parent = child(j, 'parent')?.attrs.link ?? '', ch = child(j, 'child')?.attrs.link ?? '';
    if (!parent || !ch) issues.push(`${name}: <parent link> and <child link> are required`);
    const axis = vec(child(j, 'axis')?.attrs.xyz, `${name} axis`, [1, 0, 0]);
    const limit = lim ? { lower: numAttr(lim, 'lower', `${name} limit`), upper: numAttr(lim, 'upper', `${name} limit`), effort: numAttr(lim, 'effort', `${name} limit`), velocity: numAttr(lim, 'velocity', `${name} limit`) } : undefined;
    const mimic = mim ? { joint: mim.attrs.joint ?? '', multiplier: numAttr(mim, 'multiplier', `${name} mimic`) ?? 1, offset: numAttr(mim, 'offset', `${name} mimic`) ?? 0 } : undefined;
    return { name, type, parent, child: ch, xyz: vec(o?.attrs.xyz, `${name} origin xyz`), rpy: vec(o?.attrs.rpy, `${name} origin rpy`), axis, ...(limit ? { limit } : {}), ...(mimic ? { mimic } : {}) };
  });
  // The structure: unique names; joints between links that exist; one parent a link; one root; no cycle.
  const linkNames = new Set<string>();
  for (const l of links) { if (linkNames.has(l.name)) issues.push(`link ${l.name} twice`); linkNames.add(l.name); }
  const jointNames = new Set<string>(), parentOf = new Map<string, string>();
  for (const j of joints) {
    if (jointNames.has(j.name)) issues.push(`joint ${j.name} twice`); jointNames.add(j.name);
    for (const l of [j.parent, j.child]) if (l && !linkNames.has(l)) issues.push(`${j.name}: no link ${l}`);
    if (parentOf.has(j.child)) issues.push(`${j.child} is the child of two joints`); parentOf.set(j.child, j.parent);
    if ((j.type === 'revolute' || j.type === 'prismatic') && (j.limit?.lower === undefined || j.limit.upper === undefined || j.limit.effort === undefined || j.limit.velocity === undefined)) issues.push(`${j.name}: a ${j.type} joint needs <limit lower upper effort velocity>`);
    if (j.limit?.lower !== undefined && j.limit.upper !== undefined && j.limit.lower > j.limit.upper) issues.push(`${j.name}: lower above upper`);
    if (j.type !== 'fixed' && Math.abs(Math.hypot(...j.axis) - 1) > 1e-9) issues.push(`${j.name}: its axis is not a unit vector`);
    if (j.mimic && !joints.some(k => k.name === j.mimic!.joint)) issues.push(`${j.name}: mimics no joint ${j.mimic.joint}`);
  }
  const roots = links.filter(l => !parentOf.has(l.name));
  if (roots.length !== 1) issues.push(`${roots.length} root links (${roots.map(r => r.name).join(', ')}): a URDF is one tree`);
  for (const l of links) { let k = l.name, steps = 0; while (parentOf.has(k) && steps++ <= links.length) k = parentOf.get(k)!; if (steps > links.length) { issues.push(`a cycle through ${l.name}`); break; } }
  // The inertials: mass above 0, the inertia positive definite and its principal moments a triangle.
  for (const l of links) if (l.inertial) {
    const { mass, I } = l.inertial;
    if (!(mass > 0)) issues.push(`${l.name}: mass ${mass} is not above 0`);
    const ev = eigen3([I[0], I[1], I[2], I[1], I[3], I[4], I[2], I[4], I[5]]), tol = 1e-9 * Math.abs(ev[2]);
    if (!(ev[0] > 0)) issues.push(`${l.name}: its inertia is not positive definite`);
    if (ev[2] > ev[0] + ev[1] + tol) issues.push(`${l.name}: its principal moments break the triangle inequality`);
  }
  if (files) for (const l of links) for (const m of l.meshes) if (!files.has(m)) issues.push(`${l.name}: no file ${m}`);
  return { model: { name: root.attrs.name ?? '', links, joints }, issues };
}
/** A symmetric 3 × 3's eigenvalues, ascending (the closed form for real symmetric matrices). */
function eigen3(a: number[]): V3 {
  const p1 = a[1] * a[1] + a[2] * a[2] + a[5] * a[5];
  if (p1 === 0) return [a[0], a[4], a[8]].sort((x, y) => x - y) as V3;
  const q = (a[0] + a[4] + a[8]) / 3, p2 = (a[0] - q) ** 2 + (a[4] - q) ** 2 + (a[8] - q) ** 2 + 2 * p1, p = Math.sqrt(p2 / 6);
  const b = a.map((x, i) => (x - (i % 4 === 0 ? q : 0)) / p), r = (b[0] * (b[4] * b[8] - b[5] * b[7]) - b[1] * (b[3] * b[8] - b[5] * b[6]) + b[2] * (b[3] * b[7] - b[4] * b[6])) / 2;
  const phi = r <= -1 ? Math.PI / 3 : r >= 1 ? 0 : Math.acos(r) / 3, e1 = q + 2 * p * Math.cos(phi), e3 = q + 2 * p * Math.cos(phi + 2 * Math.PI / 3);
  return [e3, 3 * q - e1 - e3, e1];
}

type M4 = { R: number[]; t: V3 };
const rpyMatrix = ([r, p, y]: V3): number[] => {
  const cr = Math.cos(r), sr = Math.sin(r), cp = Math.cos(p), sp = Math.sin(p), cy = Math.cos(y), sy = Math.sin(y);
  return [cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr, sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr, -sp, cp * sr, cp * cr];
};
const compose = (a: M4, b: M4): M4 => {
  const R = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) R[i * 3 + j] += a.R[i * 3 + k] * b.R[k * 3 + j];
  return { R, t: [0, 1, 2].map(i => a.R[i * 3] * b.t[0] + a.R[i * 3 + 1] * b.t[1] + a.R[i * 3 + 2] * b.t[2] + a.t[i]) as V3 };
};
/** The motion a joint makes at q, in the child frame: a turn about the axis, or a slide along it (metres). */
function jointMotion(j: UrdfJoint, q: number): M4 {
  if (j.type === 'prismatic') return { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [j.axis[0] * q, j.axis[1] * q, j.axis[2] * q] };
  if (j.type !== 'revolute' && j.type !== 'continuous') return { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
  const [x, y, z] = j.axis, c = Math.cos(q), s = Math.sin(q), v = 1 - c;
  return { R: [v * x * x + c, v * x * y - s * z, v * x * z + s * y, v * x * y + s * z, v * y * y + c, v * y * z - s * x, v * x * z - s * y, v * y * z + s * x, v * z * z + c], t: [0, 0, 0] };
}
/** Each link's pose (metres) in the root link's frame at joint values `q` (by joint name; mimic joints from their leader). */
export function urdfFk(model: UrdfModel, q: Readonly<Record<string, number>>): Map<string, M4> {
  const value = (j: UrdfJoint) => (j.mimic ? j.mimic.multiplier * (q[j.mimic.joint] ?? 0) + j.mimic.offset : q[j.name] ?? 0);
  const parentOf = new Map(model.joints.map(j => [j.child, j])), root = model.links.find(l => !parentOf.has(l.name))!, out = new Map<string, M4>([[root.name, { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }]]);
  const place = (link: string): M4 => {
    const have = out.get(link); if (have) return have;
    const j = parentOf.get(link)!, pose = compose(compose(place(j.parent), { R: rpyMatrix(j.rpy), t: j.xyz }), jointMotion(j, value(j)));
    out.set(link, pose); return pose;
  };
  for (const l of model.links) place(l.name);
  return out;
}
