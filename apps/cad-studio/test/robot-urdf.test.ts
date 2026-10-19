import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { evaluatePart, type BodyResult } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { dispatchTool } from '../src/chat/tools';
import { treeOfDoc, urdfOfDoc } from '../src/chat/robot';
import { forwardKinematics } from '../src/robot/fk';
import { convexHull, HullError } from '../src/robot/hull';
import { rpyOf, type UrdfResult } from '../src/robot/urdf';
import { parseXml, readUrdf, urdfFk, XmlError } from '../src/robot/urdfCheck';
import { symmetricEigen, type Mat3 } from '../src/robot/inertia';
import { cliMain } from '../server/cadCli';

// RM4 (O17): URDF export — its convex hulls, our XML reader, the structural rules of the URDF spec, forward kinematics
// read back from the URDF (URDF's own composition) against RM2's, inertials against RM3's, the refusals, the tool and
// the CLI. MuJoCo/PyBullet and check_urdf are pending (scripts/urdf-oracle.py; expect.json files written here).

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const caseDoc = (name: string): StudioDoc => JSON.parse(readFileSync(join(CASES, name, 'case.json'), 'utf8')).input.document;
const bodiesOf = async (doc: StudioDoc) => { const r = await evaluate(doc); assert.ok(r.ok); return r.bodies as BodyResult[]; };
async function exported(doc: StudioDoc): Promise<Extract<UrdfResult, { ok: true }>> { const r = await urdfOfDoc(doc, await bodiesOf(doc), evaluate, 'robot'); assert.ok(r.ok, JSON.stringify(!r.ok && r.refusals)); return r; }
let seed = 11; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const withLimits = (doc: StudioDoc, joints: Record<string, object>): StudioDoc => ({ ...doc, robot: { version: 1, joints } as StudioDoc['robot'] });

/** The signed volume of a closed triangle mesh, and whether each directed edge has its reverse once (closed, oriented). */
function closedVolume(p: ArrayLike<number>, idx: ArrayLike<number>): { volume: number; closed: boolean } {
  let v = 0; const edges = new Map<string, number>();
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    v += (p[a * 3] * (p[b * 3 + 1] * p[c * 3 + 2] - p[b * 3 + 2] * p[c * 3 + 1]) - p[a * 3 + 1] * (p[b * 3] * p[c * 3 + 2] - p[b * 3 + 2] * p[c * 3]) + p[a * 3 + 2] * (p[b * 3] * p[c * 3 + 1] - p[b * 3 + 1] * p[c * 3])) / 6;
    for (const [u, w] of [[a, b], [b, c], [c, a]]) edges.set(`${u},${w}`, (edges.get(`${u},${w}`) ?? 0) + 1);
  }
  return { volume: v, closed: [...edges].every(([k, n]) => { const [u, w] = k.split(','); return n === 1 && edges.get(`${w},${u}`) === 1; }) };
}
/** The largest distance of any point in front of any hull face (≤ 0 when every point is inside). */
function outside(h: { positions: ArrayLike<number>; indices: ArrayLike<number> }, pts: ArrayLike<number>): number {
  let worst = -Infinity; const p = h.positions;
  for (let t = 0; t < h.indices.length; t += 3) {
    const [a, b, c] = [h.indices[t], h.indices[t + 1], h.indices[t + 2]];
    const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    for (let i = 0; i < pts.length; i += 3) worst = Math.max(worst, nx * (pts[i] - p[a * 3]) + ny * (pts[i + 1] - p[a * 3 + 1]) + nz * (pts[i + 2] - p[a * 3 + 2]));
  }
  return worst;
}

test('the convex hull: a cube with points inside — 12 triangles, volume 1, closed; 2000 random points — closed, convex, every point in; flat input refused', () => {
  const cube = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.2, 0.7, 0.1, 0.5, 0.5, 1];
  const h = convexHull(cube), c = closedVolume(h.positions, h.indices);
  assert.equal(h.indices.length / 3, 12); assert.ok(c.closed && Math.abs(c.volume - 1) < 1e-12, JSON.stringify(c));
  const pts: number[] = [];
  for (let i = 0; i < 2000; i++) { const u = rand() * 2 - 1, th = rand() * 2 * Math.PI, r = Math.cbrt(rand()) * 30; pts.push(r * Math.sqrt(1 - u * u) * Math.cos(th) + 5, r * Math.sqrt(1 - u * u) * Math.sin(th), r * u - 2); }
  const s = convexHull(pts), sc = closedVolume(s.positions, s.indices), V = s.positions.length / 3, F = s.indices.length / 3;
  assert.ok(sc.closed && sc.volume > 0 && sc.volume < 4 / 3 * Math.PI * 27000, JSON.stringify(sc));
  assert.equal(V - 3 * F / 2 + F, 2, 'Euler: V − E + F = 2');
  assert.ok(outside(s, pts) < 1e-6, String(outside(s, pts)));
  assert.throws(() => convexHull([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), (e: unknown) => e instanceof HullError && e.code === 'DEGENERATE');
  assert.throws(() => convexHull([0, 0, 0, 1, 1, 1]), (e: unknown) => e instanceof HullError && e.code === 'TOO_FEW');
});

test('the XML reader: elements, attributes, comments, entities; typed errors with their place', () => {
  const x = parseXml('<?xml version="1.0"?>\n<!-- a -->\n<robot name="a &amp; b"><link name=\'l\'/><joint name="j"><parent link="l"/></joint></robot>');
  assert.deepEqual([x.name, x.attrs.name, x.children.map(c => c.name), x.children[1].children[0].attrs.link], ['robot', 'a & b', ['link', 'joint'], 'l']);
  for (const bad of ['<robot>', '<robot></link>', '<a/><b/>', '<robot x="1" x="2"/>', '<robot name="&nope;"/>', '<robot><!-- open </robot>']) assert.throws(() => parseXml(bad), XmlError, bad);
});

test('the export read back: the URDF spec\'s structure, the joints, the inertials as RM3, the meshes named and present', async () => {
  const doc = caseDoc('revolute-limited'), r = await exported(doc), files = new Set(r.files.map(f => f.path));
  const { model, issues } = readUrdf(r.urdf, files);
  assert.deepEqual(issues, []);
  assert.deepEqual([model.links.map(l => l.name), model.joints.map(j => [j.name, j.type, j.parent, j.child])], [['base', 'arm'], [['base_to_arm', 'revolute', 'base', 'arm']]]);
  const j = model.joints[0];
  assert.deepEqual([j.axis, j.limit, j.xyz.map(v => Math.round(v * 1e9) / 1e9 + 0), j.rpy.map(v => Math.round(v * 1e12) / 1e12 + 0)], [[0, 0, 1], { lower: -1.5, upper: 1.5, effort: 2, velocity: 3 }, [0.02, 0.02, 0.01], [0, 0, 0]]);
  // The arm's inertial: its mass and centre (20 mm along X from the hole, 2.5 up) as RM3 gives them.
  const arm = model.links[1].inertial!, m = (60 * 20 * 5 - 2 * Math.PI * 25 * 5) * 2.7e-6;
  assert.ok(Math.abs(arm.mass - m) < 1e-15 && Math.abs(arm.xyz[0] - 0.02) < 1e-12 && Math.abs(arm.xyz[2] - 0.0025) < 1e-12, JSON.stringify(arm));
  assert.deepEqual([...files].sort(), ['meshes/arm.stl', 'meshes/arm_collision.stl', 'meshes/base.stl', 'meshes/base_collision.stl']);
  for (const f of r.files) assert.equal(f.data.length, 84 + 50 * new DataView(f.data.buffer, f.data.byteOffset).getUint32(80, true), f.path);
  // A file named but missing, a second root, a bad axis: the checker says so.
  assert.ok(readUrdf(r.urdf, new Set()).issues.some(i => /no file meshes\/arm\.stl/.test(i)));
  assert.ok(readUrdf(r.urdf.replace('<child link="arm"/>', '<child link="base"/>')).issues.some(i => /a cycle through base/.test(i)), 'the base made its own child: a cycle');
  assert.ok(readUrdf(r.urdf.replace('<axis xyz="0 0 1"/>', '<axis xyz="0 0 2"/>')).issues.some(i => /not a unit vector/.test(i)));
  assert.ok(readUrdf(r.urdf.replace(/<limit [^>]*\/>/, '')).issues.some(i => /needs <limit/.test(i)));
});

/** RM2's FK of each link frame, in the root link's frame (metres), against the URDF's own at the same values. */
async function fkRoundTrip(doc: StudioDoc, samples: number, values: (keys: string[]) => Record<string, number>) {
  const bodies = await bodiesOf(doc), tree = await treeOfDoc(doc, bodies, evaluate), r = await exported(doc), { model } = readUrdf(r.urdf);
  const W = r.frames, root = W.get(tree.base)!;
  let worst = 0;
  for (let k = 0; k < samples; k++) {
    const q = values(tree.joints.filter(j => j.type !== 'fixed' && !j.mimic).map(j => j.key)), fk = forwardKinematics(tree, q);
    const urdf = urdfFk(model, Object.fromEntries(Object.entries(fk.values).map(([key, v]) => [r.names.joints[key], tree.joints.find(j => j.key === key)!.type === 'prismatic' ? v / 1000 : v])));
    for (const l of tree.links) {
      const D = fk.motions.get(l.id)!, H = W.get(l.id)!;
      // (World at q: D ∘ H; in the root's frame: root⁻¹ ∘ that.)
      const o = [0, 1, 2].map(i => D.R[i * 3] * H.o[0] + D.R[i * 3 + 1] * H.o[1] + D.R[i * 3 + 2] * H.o[2] + D.t[i]), R = [0, 1, 2].flatMap(i => [0, 1, 2].map(j => D.R[i * 3] * H.R[j] + D.R[i * 3 + 1] * H.R[3 + j] + D.R[i * 3 + 2] * H.R[6 + j]));
      const rel = [0, 1, 2].map(i => (root.R[i] * (o[0] - root.o[0]) + root.R[3 + i] * (o[1] - root.o[1]) + root.R[6 + i] * (o[2] - root.o[2])) / 1000);
      const relR = [0, 1, 2].flatMap(i => [0, 1, 2].map(j => root.R[i] * R[j] + root.R[3 + i] * R[3 + j] + root.R[6 + i] * R[6 + j]));
      const u = urdf.get(r.names.links[l.id])!;
      worst = Math.max(worst, ...rel.map((v, i) => Math.abs(v - u.t[i])), ...relR.map((v, i) => Math.abs(v - u.R[i])));
    }
  }
  return { worst, r, tree };
}

test('forward kinematics read back from the URDF equals RM2\'s: the 2R arm, the gear pair (mimic), a slide-and-turn chain through a dummy link', async () => {
  const turn = (keys: string[]) => Object.fromEntries(keys.map(k => [k, (rand() * 2 - 1) * Math.PI]));
  const a = await fkRoundTrip(caseDoc('chain-2r'), 50, turn);
  assert.ok(a.worst < 1e-12, String(a.worst));
  const g = await fkRoundTrip(caseDoc('gears'), 20, turn);
  assert.ok(g.worst < 1e-12, String(g.worst));
  assert.match(g.r.urdf, /<mimic joint="base_to_g1" multiplier="-0\.6666666666666666" offset="0"\/>/);
  const cyl = withLimits(caseDoc('cylindrical'), { 'base~arm#0': { lower: -20, upper: 20, effort: 50, velocity: 100 } });
  const c = await fkRoundTrip(cyl, 30, keys => Object.fromEntries(keys.map(k => [k, k.endsWith('#0') ? rand() * 40 - 20 : (rand() * 2 - 1) * Math.PI])));
  assert.ok(c.worst < 1e-12, String(c.worst));
  // (The dummy link: a tiny mass and inertia, not zero; the slide in metres.)
  assert.match(c.r.urdf, /<link name="arm__1">\s*<inertial>\s*<origin xyz="0 0 0" rpy="0 0 0"\/>\s*<mass value="1e-9"\/>/);
  assert.match(c.r.urdf, /<limit lower="-0\.02" upper="0\.02" effort="50" velocity="0\.1"\/>/);
  assert.deepEqual(readUrdf(c.r.urdf, new Set(c.r.files.map(f => f.path))).issues, []);
});

test('the collision hull holds every vertex of the visual mesh; the visual mesh is the part, in the link frame, in metres', async () => {
  const doc = caseDoc('chain-2r'), r = await exported(doc), stl = (p: string) => { const f = r.files.find(x => x.path === p)!, v = new DataView(f.data.buffer, f.data.byteOffset), n = v.getUint32(80, true), pts: number[] = [];
    for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) pts.push(v.getFloat32(84 + t * 50 + 12 + k * 12 + c * 4, true)); return { pts, n }; };
  for (const link of ['base', 'a', 'b']) {
    const vis = stl(`meshes/${link}.stl`), col = stl(`meshes/${link}_collision.stl`), idx = Uint32Array.from({ length: col.n * 3 }, (_, i) => i);
    assert.ok(outside({ positions: col.pts, indices: idx }, vis.pts) < 1e-7, link);
  }
  // (The arm's mesh: from its turning hole, x 0…0.06 less 0.01 → −0.01…0.05 m, y −0.01…0.01, z 0…0.005.)
  const a = stl('meshes/a.stl').pts, xs = a.filter((_, i) => i % 3 === 0), ys = a.filter((_, i) => i % 3 === 1), zs = a.filter((_, i) => i % 3 === 2);
  const near = (x: number, y: number) => Math.abs(x - y) < 1e-6;
  assert.ok(near(Math.min(...xs), -0.01) && near(Math.max(...xs), 0.05) && near(Math.min(...ys), -0.01) && near(Math.max(...ys), 0.01) && near(Math.min(...zs), 0) && near(Math.max(...zs), 0.005));
});

test('what URDF cannot hold is refused, typed: limits missing, an unsupported motion; loops left out with a note', async () => {
  const noRating = await urdfOfDoc(withLimits(caseDoc('revolute'), { 'base~arm': { lower: -1, upper: 1 } }), await bodiesOf(caseDoc('revolute')), evaluate, 'r');
  assert.ok(!noRating.ok && noRating.refusals.map(x => x.code).join() === 'LIMITS_MISSING');
  const cyl = await urdfOfDoc(caseDoc('cylindrical'), await bodiesOf(caseDoc('cylindrical')), evaluate, 'r');
  assert.ok(!cyl.ok && cyl.refusals.every(x => x.code === 'LIMITS_MISSING'), 'its slide needs limits');
  const loop = await exported(caseDoc('loop'));
  assert.ok(loop.notes.some(n => /URDF is a tree: the closure \(m3\) is not written/.test(n)), loop.notes.join('\n'));
  // A continuous joint without ratings is a URDF one as it is: no <limit>.
  assert.doesNotMatch((await exported(caseDoc('revolute'))).urdf, /<limit/);
});

test('roll, pitch, yaw: URDF\'s Rz·Ry·Rx read back, through the reader\'s own matrix, gimbal lock included', async () => {
  const { model } = readUrdf('<robot name="r"><link name="a"/><link name="b"/><joint name="j" type="fixed"><parent link="a"/><child link="b"/><origin xyz="0 0 0" rpy="0.3 -0.7 2.1"/></joint></robot>');
  const R = urdfFk(model, {}).get('b')!.R as Mat3, back = rpyOf(R);
  assert.ok(Math.abs(back[0] - 0.3) < 1e-12 && Math.abs(back[1] + 0.7) < 1e-12 && Math.abs(back[2] - 2.1) < 1e-12, String(back));
  for (const rpy of [[0.4, Math.PI / 2, -0.2], [0, -Math.PI / 2, 1]] as [number, number, number][]) {
    const m = readUrdf(`<robot name="r"><link name="a"/><link name="b"/><joint name="j" type="fixed"><parent link="a"/><child link="b"/><origin xyz="0 0 0" rpy="${rpy.join(' ')}"/></joint></robot>`).model;
    const R1 = urdfFk(m, {}).get('b')!.R, again = readUrdf(`<robot name="r"><link name="a"/><link name="b"/><joint name="j" type="fixed"><parent link="a"/><child link="b"/><origin xyz="0 0 0" rpy="${rpyOf(R1 as Mat3).join(' ')}"/></joint></robot>`).model;
    assert.ok(urdfFk(again, {}).get('b')!.R.every((x, i) => Math.abs(x - R1[i]) < 1e-12), `gimbal ${rpy}`);
  }
});

test('the export_urdf tool and cad-cli urdf; the conformance cases with what the MuJoCo oracle will compare (pending)', async () => {
  const doc = caseDoc('chain-2r'), out = await dispatchTool({ doc, bodies: await bodiesOf(doc) }, 'export_urdf', {}, evaluate), j = JSON.parse(out.content);
  assert.ok(!out.isError && !out.changed && j.check.length === 0 && j.files.length === 6 && /<robot name="robot">/.test(j.urdf), out.content.slice(0, 300));
  assert.match(JSON.parse((await dispatchTool({ doc: caseDoc('cylindrical'), bodies: await bodiesOf(caseDoc('cylindrical')) }, 'export_urdf', {}, evaluate)).content).error, /\[LIMITS_MISSING\]/);
  for (const [name, of] of [['urdf-2r', 'chain-2r'], ['urdf-gears', 'gears']] as const) {
    const dir = join(CASES, name), d = caseDoc(of), r = await exported(d), bodies = await bodiesOf(d), tree = await treeOfDoc(d, bodies, evaluate);
    if (process.env.UPDATE_RM_FIXTURES) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'robot.bcad'), JSON.stringify(d));
      const { model } = readUrdf(r.urdf), q = [0.4, -1.1], samples = [{}, Object.fromEntries(tree.joints.filter(x => !x.mimic).map((x, i) => [x.key, q[i % 2]]))];
      const links = model.links.filter(l => l.inertial && l.inertial.mass > 1e-6).map(l => {
        const I = l.inertial!.I, e = symmetricEigen([I[0], I[1], I[2], I[1], I[3], I[4], I[2], I[4], I[5]]);
        return { name: l.name, mass: l.inertial!.mass, com: l.inertial!.xyz, principal: e.values };
      });
      const fk = samples.map(s => { const v = forwardKinematics(tree, s).values, u = urdfFk(model, Object.fromEntries(Object.entries(v).map(([k, x]) => [r.names.joints[k], x])));
        return { values: Object.fromEntries(Object.entries(v).map(([k, x]) => [r.names.joints[k], x])), links: Object.fromEntries([...u].map(([n, m]) => [n, { position: m.t, rotation: m.R }])) }; });
      writeFileSync(join(dir, 'case.json'), JSON.stringify({ case: name, step: 'RM4', of, note: 'The exported URDF (robot.urdf, frozen) and, in expect.json, what scripts/urdf-oracle.py compares in MuJoCo: per link mass, centre and principal inertia; link frames at sampled joint values. The MuJoCo run is pending the owner\'s go-ahead (O17).' }, null, 1) + '\n');
      writeFileSync(join(dir, 'robot.urdf'), r.urdf);
      writeFileSync(join(dir, 'expect.json'), JSON.stringify({ tol: 1e-6, links, fk }, null, 1) + '\n');
    }
    assert.equal(r.urdf, readFileSync(join(dir, 'robot.urdf'), 'utf8'), `${name}: the URDF as frozen`);
    assert.ok(existsSync(join(dir, 'expect.json')));
  }
  // cad-cli urdf: the folder written, checked.
  const tmp = mkdtempSync(join(tmpdir(), 'cad-urdf-')); let printed = '';
  const code = await cliMain(['urdf', join(CASES, 'urdf-2r', 'robot.bcad'), '-o', tmp], { stdout: { write: (s: string) => { printed += s; return true; } } as never, stderr: { write: () => true } as never });
  assert.equal(code, 0, printed);
  assert.deepEqual(JSON.parse(printed).check, []);
  assert.equal(readFileSync(join(tmp, 'robot.urdf'), 'utf8'), readFileSync(join(CASES, 'urdf-2r', 'robot.urdf'), 'utf8'));
  assert.ok(existsSync(join(tmp, 'meshes', 'a_collision.stl')));
});
