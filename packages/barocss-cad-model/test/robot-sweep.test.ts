import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart, placeBody, type BodyResult } from '../src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { rotationMatrix } from '../src/assembly/mates';
import { solveDoc } from '../src/chat/assembly';
import { dispatchTool } from '../src/chat/tools';
import { treeOfDoc } from '../src/chat/robot';
import { applyTo, forwardKinematics } from '../src/robot/fk';
import { convexDistance, convexHull, meshClearance } from '@barocss/cad';
import { meshesMeet, pathOf, reaches, sweepLinks, sweepPath } from '../src/robot/sweep';
import type { Joint, JointTree } from '../src/robot/joints';

// RM6 (O19): the collision sweep — GJK against the polytopes' brute-force distance, the motion bound against dense
// forward kinematics, a 2R arm swept into a grounded post with its first contact against a separating-axis oracle in
// the plane, a clear path's least clearance, the 6R arm against a dense sweep, the tool, the conformance case.

const CASES = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
let seed = 9; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const docOf = (name: string): StudioDoc => name === 'arm-6r' ? JSON.parse(readFileSync(join(CASES, name, 'robot.bcad'), 'utf8')) : JSON.parse(readFileSync(join(CASES, name, 'case.json'), 'utf8')).input.document;
const hullPts = (p: Float64Array) => convexHull(p).positions;
/** A document's robot: its tree and its links' meshes and hulls, the parts placed in the world. */
async function robot(doc: StudioDoc) {
  const r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate), solved = solveDoc(doc).doc, world = new Map<string, BodyResult[]>([['base', r.bodies]]);
  for (const i of solved.instances ?? []) {
    const e = await evaluate(i.doc); assert.ok(e.ok);
    world.set(i.id, e.bodies.map(b => placeBody({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } }, rotationMatrix(i.rotation), i.position)));
  }
  return { tree, links: sweepLinks(tree, p => world.get(p), hullPts) };
}

test('GJK: the distance between convex sets equals the polytopes\' brute-force distance; boxes in closed form; 0 when they overlap', () => {
  const box = (x: number, y: number, z: number, w: number) => { const p: number[] = []; for (const a of [0, w]) for (const b of [0, w]) for (const c of [0, w]) p.push(x + a, y + b, z + c); return Float64Array.from(p); };
  assert.ok(Math.abs(convexDistance(box(0, 0, 0, 1), box(3, 0, 0, 1)) - 2) < 1e-12);
  assert.ok(Math.abs(convexDistance(box(0, 0, 0, 1), box(2, 2, 2, 1)) - Math.sqrt(3)) < 1e-12, 'corner to corner');
  assert.equal(convexDistance(box(0, 0, 0, 1), box(0.5, 0.5, 0.5, 1)), 0);
  for (let k = 0; k < 60; k++) {
    const cloud = (cx: number) => Float64Array.from({ length: 60 }, (_, i) => (i % 3 === 0 ? cx : 0) + (rand() - 0.5) * 10);
    const a = cloud(0), b = cloud(4 + rand() * 12), ha = convexHull(a), hb = convexHull(b);
    const brute = meshesMeet(ha.positions, ha.indices, hb.positions, hb.indices) ? 0 : meshClearance(ha.positions, ha.indices, hb.positions, hb.indices).distanceMM;
    assert.ok(Math.abs(convexDistance(a, b) - brute) < 1e-8, `${k}: ${convexDistance(a, b)} vs ${brute}`);
  }
});

test('the motion bound holds: no point of a link moves more than Σ|Δq_i|·r_i, over random trees and steps (dense FK)', () => {
  for (let trial = 0; trial < 30; trial++) {
    const joints: Joint[] = [], ids = ['L0'];
    for (let k = 1; k < 6; k++) {
      const a = [rand() - 0.5, rand() - 0.5, rand() - 0.5], n = Math.hypot(...a);
      joints.push({ key: `j${k}`, type: rand() < 0.75 ? 'continuous' : 'prismatic', parent: ids[k - 1], child: `L${k}`, axis: a.map(x => x / n) as [number, number, number], origin: [rand() * 100, rand() * 100, rand() * 100], mates: [] });
      ids.push(`L${k}`);
    }
    const tree: JointTree = { version: 1, base: 'L0', links: ids.map(id => ({ id, part: id, name: id })), joints, loops: [], couplings: [], problems: [], notes: [] };
    const last = ids[ids.length - 1], hull = Float64Array.from({ length: 30 }, () => rand() * 120 - 10), r = reaches(tree, last, hull);
    const q0 = Object.fromEntries(joints.map(j => [j.key, rand() * 2 - 1])), dq = Object.fromEntries(joints.map(j => [j.key, (rand() - 0.5) * (j.type === 'prismatic' ? 20 : 1)]));
    const bound = pathOf(tree, last).reduce((s, k) => s + Math.abs(dq[k]) * r.get(k)!, 0);
    // (The points as they stand at q0 are the link's at home moved by FK: the home points are q0's pulled back.)
    const m0 = forwardKinematics(tree, q0).motions.get(last)!;
    let worst = 0;
    for (let s = 0; s <= 1.0001; s += 0.01) {
      const m = forwardKinematics(tree, Object.fromEntries(joints.map(j => [j.key, q0[j.key] + s * dq[j.key]]))).motions.get(last)!;
      for (let i = 0; i < hull.length; i += 3) { const a = applyTo(m0, [hull[i], hull[i + 1], hull[i + 2]]), b = applyTo(m, [hull[i], hull[i + 1], hull[i + 2]]); worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); }
    }
    assert.ok(worst <= bound * (1 + 1e-9), `${trial}: moved ${worst} > bound ${bound}`);
  }
});

/** The 2R arm with a post grounded beside it (x 30…40, y 60…70, z 0…30): the arm swings into it turning base~a up. */
function armAndPost(): StudioDoc {
  const d = docOf('chain-2r');
  return { ...d, instances: [...d.instances!, { id: 'post', name: 'post', doc: rectanglePart(10, 10, 30), position: [30, 60, 0], rotation: [0, 0, 0], grounded: true }] };
}
/** The first angle at which the swung arm meets the post, in the plane (both span its height): separating axes, bisection. */
function firstContactInPlane(qMax: number): number {
  // (About the pivot at (20, 20): a spans x −10…50, b (on a, q2 = 0) 30…90, both y −10…10; the post x 10…20, y 40…50.)
  const rect = (x0: number, x1: number, y0: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const turn = (p: number[][], q: number) => p.map(([x, y]) => [x * Math.cos(q) - y * Math.sin(q), x * Math.sin(q) + y * Math.cos(q)]);
  const overlap = (A: number[][], B: number[][]) => {
    for (const P of [A, B]) for (let i = 0; i < 4; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % 4], n = [y1 - y0, x0 - x1];
      const pa = A.map(p => p[0] * n[0] + p[1] * n[1]), pb = B.map(p => p[0] * n[0] + p[1] * n[1]);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return false;
    }
    return true;
  };
  const post = rect(10, 20, 40, 50), hit = (q: number) => overlap(turn(rect(-10, 50, -10, 10), q), post) || overlap(turn(rect(30, 90, -10, 10), q), post);
  let lo = 0, hi = -1;
  for (let q = 0; q <= qMax; q += 1e-3) { if (hit(q)) { hi = q; break; } lo = q; }
  if (hi < 0) return Infinity;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (hit(m)) hi = m; else lo = m; }
  return hi;
}

test('a 2R arm swung into a grounded post: the first contact where the plane\'s separating axes put it; the way back clear, its least clearance', async () => {
  const { tree, links } = await robot(armAndPost());
  const qStar = firstContactInPlane(2);
  assert.ok(qStar > 0.3 && qStar < 2, String(qStar));
  const r = sweepPath(tree, links, { 'base~a': 0 }, { 'base~a': 2 });
  assert.ok(!r.clear && r.contact, JSON.stringify(r));
  const q = r.contact!.values['base~a'];
  // (Conservative: never past the contact; stopped within the clearance tolerance of it.)
  assert.ok(q <= qStar + 1e-9 && qStar - q < 1e-4, `${q} vs ${qStar}`);
  assert.ok(r.contact!.links.includes('post'));
  assert.ok(r.skipped.some(s => s.why.startsWith('parent and child')), 'parent and child not checked');
  // The other way, a quarter turn: clear, its least clearance the arm's to the post where it starts or ends.
  const back = sweepPath(tree, links, { 'base~a': 0 }, { 'base~a': -Math.PI / 2 });
  assert.ok(back.clear && back.minClearance && back.minClearance.mm > 1, JSON.stringify(back.minClearance));
});

test('the 6R arm against a dense sweep with the exact mesh test: no contact the bound let through', async () => {
  const { tree, links } = await robot(docOf('arm-6r'));
  const to = { 'l1~l2': 1.2, 'l2~l3': 2.6, 'l4~l5': -2.4 }, r = sweepPath(tree, links, {}, to);
  console.log(`6R sweep: ${r.clear ? 'clear' : `contact ${r.contact!.links.join('–')} at s ${r.contact!.s.toFixed(6)}`}, ${r.samples} samples, least clearance ${r.minClearance?.mm.toFixed(4)} mm`);
  // Dense: 200 samples up to where the sweep stopped (or the end), the meshes checked pair by pair.
  const end = r.contact ? r.contact.s : 1, keys = Object.keys(to) as (keyof typeof to)[];
  for (let k = 0; k < 200; k++) {
    const s = end * k / 200, fk = forwardKinematics(tree, Object.fromEntries(keys.map(x => [x, s * to[x]])));
    const posed = links.map(l => { const m = fk.motions.get(l.link)!, p = new Float64Array(l.positions.length); for (let i = 0; i < p.length; i += 3) { const v = applyTo(m, [l.positions[i], l.positions[i + 1], l.positions[i + 2]]); p[i] = v[0]; p[i + 1] = v[1]; p[i + 2] = v[2]; } return { id: l.link, p, i: l.indices }; });
    for (const [A, B] of r.pairs) { const a = posed.find(x => x.id === A)!, b = posed.find(x => x.id === B)!; assert.ok(!meshesMeet(a.p, a.i, b.p, b.i), `${A}–${B} meet at s = ${s} before the sweep's ${end}`); }
  }
  if (r.contact) {
    // (Where it stopped, the two links are within the tolerance: a true contact, not a false alarm.)
    const fk = forwardKinematics(tree, r.contact.values), [A, B] = r.contact.links, pose = (id: string) => { const l = links.find(x => x.link === id)!, m = fk.motions.get(id)!, p = new Float64Array(l.positions.length); for (let i = 0; i < p.length; i += 3) { const v = applyTo(m, [l.positions[i], l.positions[i + 1], l.positions[i + 2]]); p[i] = v[0]; p[i + 1] = v[1]; p[i + 2] = v[2]; } return { p, i: l.indices }; };
    const a = pose(A), b = pose(B);
    assert.ok(meshesMeet(a.p, a.i, b.p, b.i) || meshClearance(a.p, a.i, b.p, b.i).distanceMM < 1e-5, JSON.stringify(r.contact));
  }
  assert.equal(r.pairs.length, 21 - 6, 'every pair of the seven links but the six parent–child ones');
});

test('the sweep_path tool; the conformance case (rm/sweep-post: the first contact from the plane\'s closed form)', async () => {
  const doc = armAndPost(), r = await evaluate(doc); assert.ok(r.ok);
  const out = await dispatchTool({ doc, bodies: r.bodies }, 'sweep_path', { to: { 'base~a': 2 } }, evaluate), j = JSON.parse(out.content);
  assert.ok(!out.isError && !out.changed && j.clear === false && j.contact.links.includes('post'), out.content);
  assert.ok(Math.abs(j.contact.values['base~a'] - firstContactInPlane(2)) < 1e-4);
  assert.ok((await dispatchTool({ doc, bodies: r.bodies }, 'sweep_path', { to: { nope: 1 } }, evaluate)).isError);
  const dir = join(CASES, 'sweep-post');
  if (process.env.UPDATE_RM_FIXTURES) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'case.json'), JSON.stringify({ case: 'sweep-post', step: 'RM6', note: 'The 2R arm turned on base~a from 0 to 2 rad beside a grounded post (x 30…40, y 60…70, z 0…30): the first contact by separating axes in the plane (both links span the post\'s height), found by bisection, independent of the sweep.', input: { document: doc, from: {}, to: { 'base~a': 2 } }, expect: { contact_rad: firstContactInPlane(2), tol_rad: 1e-4, with: 'post' } }, null, 1) + '\n');
  }
  const c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8')), rr = await robot(c.input.document), s = sweepPath(rr.tree, rr.links, c.input.from, c.input.to);
  assert.ok(s.contact && s.contact.links.includes(c.expect.with) && c.expect.contact_rad - s.contact.values['base~a'] < c.expect.tol_rad && s.contact.values['base~a'] <= c.expect.contact_rad + 1e-9);
});
