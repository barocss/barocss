import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { chordOf } from '@barocss/cad-model/chat/references';
import { marchingTetrahedra } from '@barocss/cad';
import { cavityField, enclosedVoids, HollowError, planHollow } from '@barocss/cad-model/print/hollow';

// AM7a (O53): SDF voxel hollowing with drains. The cavity φ = depth − t > 0 meshed by marching tetrahedra and subtracted
// from the exact body; a drain from the bottom into each cavity. Wall thickness against the target; every cavity
// drained (the kernel's inner shells and a flood fill); mass against the closed forms within the S0's derived bounds.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function part(calls: [string, object][]): Promise<{ doc: StudioDoc; bodies: BodyResult[] }> {
  let s: ChatState = { doc: emptyDoc(), bodies: [] };
  for (const [c, a] of calls) { const r = await dispatchTool(s, c, a as Record<string, unknown>, evaluate); assert.ok(!r.isError, r.content); s = r.state; }
  const e = await evaluate(s.doc); assert.ok(e.ok); return { doc: s.doc, bodies: e.bodies };
}
const boxOf = (w: number, d: number, h: number, x = 0) => ['run_command', { command: 'box', values: { w, d, h, x, y: 0, z: 0 } }] as [string, object];
const code = (f: () => unknown) => { try { f(); return 'none'; } catch (e) { return e instanceof HollowError ? e.code : String(e); } };
/** Distance along a ray from p in direction u to the nearest triangle of a mesh (positions, indices). */
function rayTo(P: ArrayLike<number>, I: ArrayLike<number>, p: number[], u: number[]): number {
  let best = Infinity;
  for (let t = 0; t < I.length; t += 3) {
    const a = [0, 1, 2].map(k => P[I[t] * 3 + k]), b = [0, 1, 2].map(k => P[I[t + 1] * 3 + k]), c = [0, 1, 2].map(k => P[I[t + 2] * 3 + k]);
    const e1 = [0, 1, 2].map(k => b[k] - a[k]), e2 = [0, 1, 2].map(k => c[k] - a[k]), q = [u[1] * e2[2] - u[2] * e2[1], u[2] * e2[0] - u[0] * e2[2], u[0] * e2[1] - u[1] * e2[0]], det = e1[0] * q[0] + e1[1] * q[1] + e1[2] * q[2];
    if (Math.abs(det) < 1e-14) continue;
    const s = [0, 1, 2].map(k => p[k] - a[k]), w = (s[0] * q[0] + s[1] * q[1] + s[2] * q[2]) / det; if (w < 0 || w > 1) continue;
    const r = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (u[0] * r[0] + u[1] * r[1] + u[2] * r[2]) / det; if (v < 0 || w + v > 1) continue;
    const d = (e2[0] * r[0] + e2[1] * r[1] + e2[2] * r[2]) / det; if (d > 1e-9 && d < best) best = d;
  }
  return best;
}

test('the voxel route (asked), a 40 × 30 × 20 box to a 3 mm wall: planar walls at t to 1e-6, the wall never thinner; drained (inner shells 0, no enclosed void); mass within the bound', async () => {
  const { doc, bodies } = await part([boxOf(40, 30, 20)]), t = 3, h = 0.75, drain = 4;
  const g = cavityField(bodies[0].mesh, t, h), cav = marchingTetrahedra(g);
  // (Walls: from points on each outer face, inward along its normal, the cavity at t; the faces' middles away from edges.)
  const probes: [number[], number[]][] = [[[20, 15, 0], [0, 0, 1]], [[20, 15, 20], [0, 0, -1]], [[0, 15, 10], [1, 0, 0]], [[40, 15, 10], [-1, 0, 0]], [[20, 0, 10], [0, 1, 0]], [[20, 30, 10], [0, -1, 0]], [[12, 9, 0], [0, 0, 1]], [[33, 22, 20], [0, 0, -1]]];
  for (const [p, u] of probes) { const w = rayTo(cav.positions, cav.indices, p, u); assert.ok(Math.abs(w - t) <= 1e-6, `wall at ${p}: ${w}`); }
  // (Every cavity vertex at least t from the outside: the box is convex, its depth concave, the interpolation under-reaches.)
  let least = Infinity;
  for (let v = 0; v < cav.positions.length; v += 3) { const [x, y, z] = [cav.positions[v], cav.positions[v + 1], cav.positions[v + 2]]; least = Math.min(least, x, 40 - x, y, 30 - y, z, 20 - z); }
  assert.ok(least >= t - 1e-6, `least wall ${least}`);
  const { doc: out, report } = planHollow(doc, bodies, { t, h, drain, route: 'voxel' });
  assert.deepEqual([report.route, report.why], ['voxel', 'the voxel route was asked for']);
  assert.equal(report.cavities.length, 1); assert.equal(report.drains.length, 1); assert.ok(report.error > 0 && report.error <= h / 10);
  // (The drain in the middle of the cavity's floor: (20, 15) to within a voxel.)
  assert.ok(Math.abs(report.drains[0].at[0] - 20) <= h && Math.abs(report.drains[0].at[1] - 15) <= h, JSON.stringify(report.drains[0]));
  // (The cavity actually taken out, simplified within e: its walls at least t − h − e.)
  const dec = await evaluate({ ...out, nodes: out.nodes.slice(0, doc.nodes.length + 2) }); assert.ok(dec.ok);
  const cb = dec.bodies.find(b => b.key !== bodies[0].key)!; let leastDec = Infinity;
  for (let v = 0; v < cb.mesh.positions.length; v += 3) { const [x, y, z] = [cb.mesh.positions[v], cb.mesh.positions[v + 1], cb.mesh.positions[v + 2]]; leastDec = Math.min(leastDec, x, 40 - x, y, 30 - y, z, 20 - z); }
  assert.ok(leastDec >= t - h - report.error - 1e-5, `least wall after simplifying ${leastDec}`);
  // (Before the drain, the cavity enclosed: one inner shell, and a flood fill finds it.)
  const noDrain = { ...out, nodes: out.nodes.slice(0, doc.nodes.length + 3) }, e0 = await evaluate(noDrain); assert.ok(e0.ok);
  assert.equal(e0.bodies.length, 1); assert.equal(e0.bodies[0].innerShells, 1);
  assert.ok(enclosedVoids(e0.bodies[0].mesh, drain / 4).components >= 1);
  // (After: no inner shell, no enclosed void.)
  const e1 = await evaluate(out); assert.ok(e1.ok, JSON.stringify(!e1.ok && e1));
  assert.equal(e1.bodies.length, 1); assert.equal(e1.bodies[0].innerShells ?? 0, 0);
  assert.deepEqual(enclosedVoids(e1.bodies[0].mesh, drain / 4), { voids: 0, components: 0 });
  // (Mass: abc − (a−2t)(b−2t)(c−2t) − πr²t + δ, 0 ≤ δ ≤ L·h² + 8h³, L the cavity box's edge length.)
  const inner = [40 - 2 * t, 30 - 2 * t, 20 - 2 * t], L = 4 * (inner[0] + inner[1] + inner[2]);
  const closed = 40 * 30 * 20 - inner[0] * inner[1] * inner[2] - Math.PI * 4 * t, delta = e1.bodies[0].volumeMM3! - closed, Ae = 2 * (inner[0] * inner[1] + inner[1] * inner[2] + inner[0] * inner[2]) * report.error;
  console.log(`AM7a box: δ ${delta.toFixed(4)} mm³ in [${(-Ae).toFixed(2)}, ${(L * h * h + 8 * h ** 3 + Ae).toFixed(2)}]; e ${report.error}, ${report.nodes} nodes; wall ${JSON.stringify(report.wall)}`);
  assert.ok(delta >= -Ae - 1e-6 && delta <= L * h * h + 8 * h ** 3 + Ae, `δ ${delta}`);
});

test('the cavity mesher on a sphere R 15, t 2.5: its volume within 3·A·h²/(8(R − t)) + A·δ of 4/3·π(R − t)³, δ the display mesh\'s depth below the sphere; a curved body refused at once (CURVED_BODY: the kernel\'s mesh Booleans, F3)', async () => {
  const { doc, bodies } = await part([['run_command', { command: 'sphere', values: { r: 15, x: 0, y: 0, z: 0 } }]]), t = 2.5, h = 0.5, R = 15, rho = R - t, A = 4 * Math.PI * rho * rho, sm = bodies[0].mesh;
  // (δ: how far below the sphere the display mesh's triangles sit, the deepest point of each one's plane — a triangle's
  // middle sits lower than its edges, so chordOf (an edge's sagitta) is not enough.)
  // (The sphere command stands it on the ground: its centre the body's box's middle, (0, 0, 15).)
  const c0 = [0, 1, 2].map(q => (sm.bounds.min[q] + sm.bounds.max[q]) / 2);
  let delta = 0;
  for (let k = 0; k < sm.indices.length; k += 3) {
    const P = [0, 1, 2].map(j => [0, 1, 2].map(q => sm.positions[sm.indices[k + j] * 3 + q])), u = [0, 1, 2].map(q => P[1][q] - P[0][q]), v = [0, 1, 2].map(q => P[2][q] - P[0][q]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], L = Math.hypot(...n); if (L < 1e-9) continue;
    delta = Math.max(delta, R - Math.abs(n[0] * (P[0][0] - c0[0]) + n[1] * (P[0][1] - c0[1]) + n[2] * (P[0][2] - c0[2])) / L);
  }
  const cav = marchingTetrahedra(cavityField(sm, t, h));
  let v6 = 0; for (let k = 0; k < cav.indices.length; k += 3) { const [a, b, c] = [0, 1, 2].map(j => [0, 1, 2].map(q => cav.positions[cav.indices[k + j] * 3 + q])); v6 += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]); }
  const vc = v6 / 6, want = 4 / 3 * Math.PI * rho ** 3, bound = 3 * A * h * h / (8 * rho) + A * delta;
  console.log(`AM7a sphere cavity: ${vc.toFixed(2)} vs ${want.toFixed(2)} (|Δ| ${Math.abs(vc - want).toFixed(2)}, bound ${bound.toFixed(2)}; the mesh ${delta.toFixed(4)} mm below the sphere, chordOf ${chordOf(sm).toFixed(4)})`);
  assert.ok(Math.abs(vc - want) <= bound, `${vc} vs ${want}, bound ${bound}`);
  // (The voxel route asked for on a curved body: refused at once.)
  const t0 = Date.now();
  assert.equal(code(() => planHollow(doc, bodies, { t, h, route: 'voxel' })), 'CURVED_BODY'); assert.ok(Date.now() - t0 < 1000, 'at once');
});

test('the exact route (the kernel\'s closed shell, R11): the box to its closed form exactly, walls measured at t; the sphere and its drain; a bent sweep the shell refuses is CURVED_BODY with R11\'s reason', async () => {
  // (The box: 40·30·20 − 34·24·14, less the drain's Ø4 through the 3 mm floor — exact.)
  const box = await part([boxOf(40, 30, 20)]), { doc: out, report } = planHollow(box.doc, box.bodies, { t: 3, drain: 4 }), e = await evaluate(out); assert.ok(e.ok);
  assert.equal(report.route, 'exact'); assert.equal(report.why, undefined); assert.equal(report.error, 0);
  const want = 40 * 30 * 20 - 34 * 24 * 14 - Math.PI * 4 * 3;
  assert.ok(Math.abs(e.bodies[0].volumeMM3! - want) <= 1e-9 * want, `${e.bodies[0].volumeMM3} vs ${want}`);
  assert.equal(e.bodies[0].innerShells ?? 0, 0); assert.equal(enclosedVoids(e.bodies[0].mesh, 1).components, 0);
  assert.ok(report.wall.samples > 0 && Math.abs(report.wall.min - 3) <= 1e-5 && Math.abs(report.wall.max - 3) <= 1e-5, JSON.stringify(report.wall));
  // (The sphere: the shell is 4/3·π(15³ − 12³) exactly before the drain; drained; its walls at t within the two meshes' δ.)
  const ball = await part([['run_command', { command: 'sphere', values: { r: 15, x: 0, y: 0, z: 0 } }]]), hs = planHollow(ball.doc, ball.bodies, { t: 3, drain: 3 });
  assert.equal(hs.report.route, 'exact');
  const shellOnly = await evaluate({ ...hs.doc, nodes: hs.doc.nodes.slice(0, ball.doc.nodes.length + 1) }); assert.ok(shellOnly.ok);
  assert.ok(Math.abs(shellOnly.bodies[0].volumeMM3! - 4 / 3 * Math.PI * (15 ** 3 - 12 ** 3)) <= 1e-9 * 7000, String(shellOnly.bodies[0].volumeMM3));
  const es = await evaluate(hs.doc); assert.ok(es.ok); assert.equal(es.bodies[0].innerShells ?? 0, 0);
  const dd = chordOf(es.bodies[0].mesh);
  assert.ok(Math.abs(hs.report.wall.min - 3) <= 2 * dd + 1e-6 && Math.abs(hs.report.wall.max - 3) <= 2 * dd + 1e-6, `${JSON.stringify(hs.report.wall)}, δ ${dd}`);
  // (A pipe bent at its end: the shell refuses, the body is curved — refused, the shell's reason given.)
  const pipe = await part([['add_features', { features: [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 8 }, { kind: 'sweep', sketch: 0, path: [{ kind: 'straight', length: 40 }, { kind: 'bend', radius: 20, angleDegrees: 90, toward: 'x' }] }] }]]);
  let msg = ''; try { planHollow(pipe.doc, pipe.bodies, { t: 3 }); } catch (err) { msg = String(err); }
  assert.match(msg, /\[CURVED_BODY\] the part has \d+ curved faces? and the kernel's exact shell refused it: a closed end of a swept body must be a straight run longer than the wall/);
});

test('two thick lumps on a thin bridge: two cavities, two drains, none enclosed; refusals typed', async () => {
  // (Two 20 mm cubes in plan joined by a 4 mm wide bar, all 20 high, one body: each cube hollows, the bar is thinner than 2t.)
  const dumbbell = await part([['add_features', { features: [{ kind: 'sketch', profile: 'polygon', points: [[0, 0], [20, 0], [20, 8], [40, 8], [40, 0], [60, 0], [60, 20], [40, 20], [40, 12], [20, 12], [20, 20], [0, 20]] }, { kind: 'extrude', sketch: 0, height: 20 }] }]]);
  assert.equal(dumbbell.bodies.length, 1);
  const { doc: out, report } = planHollow(dumbbell.doc, dumbbell.bodies, { t: 2.5, h: 0.625, drain: 3 }), r = await evaluate(out); assert.ok(r.ok, JSON.stringify(!r.ok && r));
  console.log(`AM7a dumbbell: route ${report.route}${report.why ? ` (${report.why})` : ''}; wall ${JSON.stringify(report.wall)}`);
  assert.equal(report.cavities.length, 2); assert.equal(report.drains.length, 2);
  assert.equal(r.bodies[0].innerShells ?? 0, 0); assert.equal(enclosedVoids(r.bodies[0].mesh, 0.75).components, 0);
  // (Refusals.)
  const small = await part([boxOf(4, 4, 4)]); assert.equal(code(() => planHollow(small.doc, small.bodies, { t: 3 })), 'NOTHING_TO_HOLLOW');
  const two = await part([boxOf(20, 20, 20), boxOf(10, 10, 10, 30)]); assert.equal(code(() => planHollow(two.doc, two.bodies, { t: 2 })), 'ONE_BODY');
  const b = await part([boxOf(40, 30, 20)]);
  assert.equal(code(() => planHollow({ ...b.doc, print: { direction: [1, 1, 0] } }, b.bodies, { t: 2 })), 'DIRECTION_NOT_AXIS');
  for (const bad of [{ t: 0 }, { t: 2, h: 1.5 }, { t: 2, drain: 0 }]) assert.equal(code(() => planHollow(b.doc, b.bodies, bad)), 'BAD_VALUES', JSON.stringify(bad));
  assert.equal(code(() => planHollow(b.doc, b.bodies, { t: 2, h: 0.01 })), 'GRID_TOO_FINE');
});
