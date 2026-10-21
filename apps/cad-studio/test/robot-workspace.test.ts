import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart, placeBody, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { rotationMatrix } from '@barocss/cad-model/assembly/mates';
import { solveDoc } from '@barocss/cad-model/chat/assembly';
import { treeOfDoc } from '@barocss/cad-model/chat/robot';
import { applyTo, forwardKinematics } from '@barocss/cad-model/robot/fk';
import { convexHull } from '@barocss/cad-model/robot/hull';
import { probeAt, toolProbe } from '@barocss/cad-model/robot/ik';
import { meshesMeet, partParent, sweepLinks } from '@barocss/cad-model/robot/sweep';
import { workspaceMap, WorkspaceError } from '@barocss/cad-model/robot/workspace';
import type { Joint, JointTree } from '@barocss/cad-model/robot/joints';

// RM9b (O62): a workspace map. The planar 2R (l₁ 80, l₂ 50) against its annulus 30 ≤ r ≤ 130 — every occupied voxel
// meets it, every voxel wholly inside it is occupied — and w = l₁ l₂ |sin θ₂|; the elbow limited to [0, π/2], its own
// annulus; the 6R arm's reach against its straight length, w 0 there; the self-contact filter against RM6's mesh test.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
function twoR(limit?: Joint['limit']): JointTree {
  const joints: Joint[] = [
    { key: 'j1', type: 'continuous', parent: 'L0', child: 'a', axis: [0, 0, 1], origin: [0, 0, 0], mates: [] },
    { key: 'j2', type: limit ? 'revolute' : 'continuous', parent: 'a', child: 'b', axis: [0, 0, 1], origin: [80, 0, 0], mates: [], ...(limit ? { limit } : {}) }];
  return { version: 1, base: 'L0', links: ['L0', 'a', 'b'].map(id => ({ id, part: id, name: id })), joints, loops: [], couplings: [], problems: [], notes: [] };
}
/** The square cell (ix, iy) of side h against the annulus rIn ≤ r ≤ rOut: wholly inside it, or meeting it. */
function cellAgainst(ix: number, iy: number, h: number, rIn: number, rOut: number): { inside: boolean; meets: boolean } {
  const x0 = ix * h, y0 = iy * h, x1 = x0 + h, y1 = y0 + h;
  const near = Math.hypot(Math.max(x0, 0, -x1), Math.max(y0, 0, -y1)), far = Math.max(Math.hypot(x0, y0), Math.hypot(x1, y0), Math.hypot(x0, y1), Math.hypot(x1, y1));
  return { inside: near >= rIn && far <= rOut, meets: near <= rOut && far >= rIn };
}
/** The occupancy against the annulus: occupied ⊆ meeting, inside ⊆ occupied (the plane z ∈ [0, h): the voxels' first layer). */
function checkAnnulus(map: ReturnType<typeof workspaceMap>, rIn: number, rOut: number) {
  const h = map.h, occ = new Set(map.voxels.map(v => `${Math.floor(v.c[0] / h)},${Math.floor(v.c[1] / h)}`));
  assert.ok(map.voxels.every(v => Math.floor(v.c[2] / h) === 0), 'all in the plane');
  let inside = 0, meets = 0;
  const n = Math.ceil(rOut / h) + 1;
  for (let ix = -n; ix <= n; ix++) for (let iy = -n; iy <= n; iy++) {
    const c = cellAgainst(ix, iy, h, rIn, rOut), o = occ.has(`${ix},${iy}`);
    if (c.inside) { inside++; assert.ok(o, `cell ${ix},${iy} wholly inside the annulus is empty`); }
    if (c.meets) meets++;
    if (o) assert.ok(c.meets, `cell ${ix},${iy} occupied but off the annulus`);
  }
  // (Every occupied voxel centre within h√3/2 of the annulus: it meets it, and the centre is at z h/2.)
  for (const v of map.voxels) { const r = Math.hypot(v.c[0], v.c[1]), gap = Math.max(rIn - r, r - rOut, 0); assert.ok(Math.hypot(gap, v.c[2]) <= h * Math.sqrt(3) / 2 + 1e-9, JSON.stringify(v)); }
  const area = Math.PI * (rOut * rOut - rIn * rIn), occupied = occ.size * h * h;
  return { inside, meets, occupied: occ.size, area, occupiedArea: occupied };
}

test('the planar 2R (80, 50): occupied voxels meet the annulus 30 ≤ r ≤ 130, every voxel wholly inside is occupied, the area within the boundary band; w = l₁ l₂ |sin θ₂|', () => {
  const tree = twoR(), h = 5, map = workspaceMap(tree, { link: 'b', tool: [130, 0, 0], samples: 100000, h });
  const r = checkAnnulus(map, 30, 130);
  // (The fewest points a cell can expect: the joint-space density over the area element l₁l₂|sin θ₂|, both elbows,
  // N·2/(4π² l₁ l₂) per mm² × h² ≈ 31.7 — a random sampling would miss a cell with chance e^−31.7 ≈ 2e-14.)
  const least = 100000 * 2 / (4 * Math.PI ** 2 * 80 * 50) * h * h;
  console.log(`RM9b 2R: ${map.voxels.length} voxels; inside ${r.inside} ≤ occupied ${r.occupied} ≤ meeting ${r.meets}; area ${r.occupiedArea} mm² vs π(130² − 30²) ${r.area.toFixed(1)} (band ${(r.meets - r.inside) * h * h} mm²); least expected per cell ${least.toFixed(1)}; reach ${map.reach.toFixed(6)}`);
  assert.ok(r.inside * h * h <= r.area && r.area <= r.meets * h * h);
  assert.ok(Math.abs(r.occupiedArea - r.area) <= (r.meets - r.inside) * h * h);
  assert.ok(map.reach <= 130 + 1e-9 && map.reach >= 130 - h);
  // (w against its closed form at 200 poses, m²: l₁ l₂ |sin θ₂| with l in m.)
  const probe = toolProbe(tree, 'b', [130, 0, 0]), x = new Float64Array(3);
  for (let k = 0; k < 200; k++) {
    const q = { j1: Math.sin(k * 1.7) * 3, j2: Math.cos(k * 2.3) * 3 }, w = probeAt(probe, q, x);
    assert.ok(Math.abs(w - 0.08 * 0.05 * Math.abs(Math.sin(q.j2))) <= 1e-9 * 0.004, `${w} at ${q.j2}`);
    const r2 = Math.hypot(x[0], x[1]); assert.ok(Math.abs(r2 - Math.sqrt(80 ** 2 + 50 ** 2 + 2 * 80 * 50 * Math.cos(q.j2))) <= 1e-9);
  }
});

test('the elbow limited to [0, π/2]: its annulus √(80² + 50²) ≤ r ≤ 130, by the same occupancy tests; a slide without limits refused', () => {
  const map = workspaceMap(twoR({ lower: 0, upper: Math.PI / 2 }), { link: 'b', tool: [130, 0, 0], samples: 100000, h: 5 }), rIn = Math.hypot(80, 50);
  const r = checkAnnulus(map, rIn, 130);
  console.log(`RM9b limited 2R: inside ${r.inside} ≤ occupied ${r.occupied} ≤ meeting ${r.meets}`);
  assert.deepEqual(map.ranges.j2, [0, Math.PI / 2]);
  const slide = twoR(); slide.joints[1] = { ...slide.joints[1], type: 'prismatic', axis: [1, 0, 0] };
  assert.throws(() => workspaceMap(slide, { link: 'b', samples: 10, h: 5 }), (e: unknown) => e instanceof WorkspaceError && e.code === 'NO_RANGE');
  assert.throws(() => workspaceMap(twoR(), { link: 'b', samples: 0, h: 5 }), (e: unknown) => e instanceof WorkspaceError && e.code === 'BAD_VALUES');
});

async function arm6r() {
  const doc: StudioDoc = JSON.parse(readFileSync(join(CASES, 'arm-6r', 'robot.bcad'), 'utf8')), r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate), solved = solveDoc(doc).doc, world = new Map<string, BodyResult[]>([['base', r.bodies]]);
  for (const i of solved.instances ?? []) { const e = await evaluate(i.doc); assert.ok(e.ok); world.set(i.id, e.bodies.map(b => placeBody({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } }, rotationMatrix(i.rotation), i.position))); }
  return { tree, links: sweepLinks(tree, p => world.get(p), p => convexHull(p).positions) };
}

test('the 6R arm: its reach the straight arm\'s length within h, no voxel past it, w 0 at the straight pose; the same map twice', async () => {
  const { tree } = await arm6r(), end = tree.joints[tree.joints.length - 1].child, h = 20;
  const probe = toolProbe(tree, end), x = new Float64Array(3), w0 = probeAt(probe, {}, x);
  const first = tree.joints.find(j => j.type !== 'fixed' && !j.mimic)!.origin, straight = Math.hypot(x[0] - first[0], x[1] - first[1], x[2] - first[2]);
  const map = workspaceMap(tree, { link: end, samples: 20000, h }), again = workspaceMap(tree, { link: end, samples: 20000, h });
  console.log(`RM9b 6R: reach ${map.reach.toFixed(3)} mm vs straight ${straight.toFixed(3)} mm; ${map.voxels.length} voxels; w at straight ${w0.toExponential(2)}; best w ${Math.max(...map.voxels.map(v => v.w)).toExponential(3)}`);
  assert.ok(w0 <= 1e-9, String(w0));
  assert.ok(map.reach <= straight + 1e-9 && map.reach >= straight - h, `${map.reach} vs ${straight}`);
  for (const v of map.voxels) assert.ok(Math.hypot(v.c[0] - first[0], v.c[1] - first[1], v.c[2] - first[2]) <= straight + h * Math.sqrt(3) / 2 + 1e-9);
  assert.equal(JSON.stringify(again), JSON.stringify(map), 'deterministic');
});

test('the self-contact filter on the 6R: the poses left out are those RM6\'s mesh test finds in contact', async () => {
  const { tree, links } = await arm6r(), end = tree.joints[tree.joints.length - 1].child, N = 300;
  const map = workspaceMap(tree, { link: end, samples: N, h: 20, links });
  // (The same Halton poses, checked here pair by pair with the exact mesh test, no hull prefilter.)
  const plain = workspaceMap(tree, { link: end, samples: N, h: 20 }), keys = Object.keys(plain.ranges), primes = [2, 3, 5, 7, 11, 13, 17, 19];
  const halton = (i: number, b: number) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  const parentOf = new Map(tree.joints.map(j => [j.child, j.parent]));
  let contact = 0;
  for (let i = 1; i <= N; i++) {
    const q = Object.fromEntries(keys.map((k, d) => [k, plain.ranges[k][0] + halton(i, primes[d]) * (plain.ranges[k][1] - plain.ranges[k][0])])), fk = forwardKinematics(tree, q);
    const P = links.map(l => { const m = fk.motions.get(l.link)!, p = new Float64Array(l.positions.length); for (let k = 0; k < p.length; k += 3) { const v = applyTo(m, [l.positions[k], l.positions[k + 1], l.positions[k + 2]]); p[k] = v[0]; p[k + 1] = v[1]; p[k + 2] = v[2]; } return p; });
    let hit = false;
    for (let a = 0; a < links.length && !hit; a++) for (let b = a + 1; b < links.length && !hit; b++) {
      if (partParent(parentOf, links[a].link) === links[b].link || partParent(parentOf, links[b].link) === links[a].link) continue;
      if (meshesMeet(P[a], links[a].indices, P[b], links[b].indices)) hit = true;
    }
    if (hit) contact++;
  }
  console.log(`RM9b filter: ${map.excluded} of ${N} poses left out; the mesh test finds ${contact}`);
  assert.ok(map.excluded > 0, 'some poses fold the arm into itself');
  assert.equal(map.excluded, contact);
  assert.equal(plain.excluded, 0);
});
