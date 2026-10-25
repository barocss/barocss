import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { withLook } from '@barocss/cad-model/app/bodies';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { undercuts } from '@barocss/cad-model/mould/undercut';
import { printability } from '@barocss/cad-model/print/rules';
import { summarize } from '../server/chatServer';

// IM3 (O79): undercuts by ±d visibility, on constructed cases — a side hole across the pull (hidden both ways, freed
// along its own axis), a hole along it (none), a snap hook's latch (the catch and what lies under it, freed by a side
// action along the latch), an internal groove in a bore (freed by no straight action across the pull); the report's rule.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
async function build(calls: [string, Record<string, unknown>][]): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of calls) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
const box = (w: number, d: number, h: number): [string, Record<string, unknown>] => ['run_command', { command: 'box', values: { w, d, h, x: 0, y: 0, z: 0 } }];
const parallel = (a: readonly number[], b: readonly number[]) => Math.abs(Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) - 1) <= 1e-12;
const meshArea = (s: ChatState, name: string) => { const m = s.bodies[0].mesh, idx = new Set(m.faces.filter(f => f.name === name).map(f => f.index)); let A = 0; for (let t = 0; t < m.indices.length; t += 3) if (idx.has(m.faceOfVertex[m.indices[t]])) { const p = [0, 1, 2].map(k => [0, 1, 2].map(j => m.positions[3 * m.indices[t + k] + j])), u = p[1].map((v, j) => v - p[0][j]), v = p[2].map((x, j) => x - p[0][j]); A += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; } return A; };

test('IM3 a block with a hole along the pull and one across it: the side hole\'s whole bore one undercut region, its area the bore\'s, freed by a side action along its own axis; the vertical hole none', async () => {
  const s = await build([box(40, 30, 20), ['run_command', { command: 'hole', values: { d: 6, x: 6, y: 6 }, faces: ['n1.top'] }], ['run_command', { command: 'hole', values: { d: 6, x: 20, y: 10 }, faces: [{ normal: [0, -1, 0], pick: 'max' }] }]]);
  const r = undercuts(s.bodies, [0, 0, 1]);
  assert.equal(r.regions.length, 1, JSON.stringify(r.regions.map(x => x.faces)));
  const [g] = r.regions, bore = s.bodies[0].mesh.faces.find(f => f.exact?.kind === 'cylinder' && Math.abs(Math.abs((f.exact as { a: number[] }).a[1]) - 1) < 1e-9)!.name;
  assert.deepEqual(g.faces, [bore]);
  assert.ok(Math.abs(g.area - meshArea(s, bore)) <= 1e-9 * g.area, `${g.area} vs ${meshArea(s, bore)}`);
  assert.ok(g.sideAction && parallel(g.sideAction, [0, 1, 0]), JSON.stringify(g.best));
  // (Pulled along y instead, the side hole is the one along the pull: no undercut — the vertical one is across it now.)
  const y = undercuts(s.bodies, [0, 1, 0]);
  assert.equal(y.regions.length, 1); assert.ok(y.regions[0].sideAction && parallel(y.regions[0].sideAction, [0, 0, 1]));
});

test('IM3 a snap hook standing on a plate: its catch, the beam\'s face under the latch and the plate under it hidden both ways along the pull; a side action along the latch frees them — a plain post in its place (mutant) has none', async () => {
  const s = await build([box(40, 20, 3), ['add_library_part', { library: 'enclosure', part: 'snap-hook', face: 'n1.top', point: [20, 10, 3], x_direction: [0, 1, 0], params: { L: 12, t: 1.5, b: 6, y: 1 } }]]), prefix = (s.doc.nodes.at(-1) as { prefix: string }).prefix;
  const r = undercuts(s.bodies, [0, 0, 1]);
  assert.equal(r.regions.length, 1, JSON.stringify(r.regions.map(x => x.faces)));
  const [g] = r.regions;
  // (The catch 1 × 6 and the beam's face below the latch 12 × 6; the plate's top under the latch, 1 × 6, to the sampling step.)
  assert.deepEqual(g.faces, [`${prefix}_h.side1`, `${prefix}_h.side2`, 'n1.top']);
  assert.ok(Math.abs(g.area - (6 + 72 + 6)) <= 1, String(g.area));
  assert.ok(g.sideAction && parallel(g.sideAction, [1, 0, 0]) && g.sideAction[0] > 0, JSON.stringify(g.best));
  const post = await build([box(40, 20, 3), box(1.5, 6, 14).map((x, k) => k ? { ...(x as Record<string, unknown>), values: { w: 1.5, d: 6, h: 14, x: 19.25, y: 7, z: 3 } } : x) as [string, Record<string, unknown>], ['run_command', { command: 'union', values: {}, bodies: ['b1', 'b3'] }]]);
  assert.deepEqual(undercuts(post.bodies, [0, 0, 1]).regions, []);
});

test('IM3 an internal groove in a bore along the pull: hidden both ways, and no side action across the pull frees it (the bore\'s walls in every direction)', async () => {
  const s = await build([box(40, 40, 30), ['run_command', { command: 'hole', values: { d: 10, x: 20, y: 20 }, faces: ['n1.top'] }], ['run_command', { command: 'cylinder', values: { r: 8, h: 4, x: 20, y: 20, z: 13 } }], ['run_command', { command: 'difference', values: {}, bodies: ['b2', 'b4'] }]]);
  assert.equal(s.bodies.length, 1);
  const r = undercuts(s.bodies, [0, 0, 1]);
  assert.ok(r.regions.length >= 1, 'the groove');
  assert.ok(r.regions.every(g => g.sideAction === null && g.best.clearShare < 1), JSON.stringify(r.regions.map(g => [g.faces, g.best.clearShare])));
  // (The groove lies between z 13 and 17: every region's centre there.)
  for (const g of r.regions) assert.ok(g.centroid[2] > 13 - 1e-6 && g.centroid[2] < 17 + 1e-6, JSON.stringify(g.centroid));
});

test('IM3 in the manufacturability report: the side hole warned (a side action named); the groove fails; a plain box passes; no pull — unknown; the regions listed', async () => {
  const moulded = (s: ChatState, pull?: [number, number, number]): StudioDoc => withLook({ ...s.doc, process: 'injection', mould: { version: 1, ...(pull ? { pull } : {}), finish: 'smooth' } }, s.bodies[0], { material: 'abs' });
  const rule = async (s: ChatState, pull?: [number, number, number]) => { const d = moulded(s, pull), r = await printability(d, s.bodies, evaluate); return { u: r.rules.find(x => x.id === 'undercut')!, r }; };
  const side = await build([box(40, 30, 20), ['run_command', { command: 'hole', values: { d: 6, x: 20, y: 10 }, faces: [{ normal: [0, -1, 0], pick: 'max' }] }]]);
  const first = await rule(side, [0, 0, 1]), r = first.r;
  let u = first.u;
  assert.equal(u.status, 'warn'); assert.match(u.message, /^1 undercut region \(.* mm²\): 1 freed by a side action \(\[0, -?1, 0\]\) \(sampled every ≤ [\d.]+ mm: an undercut smaller than that may be missed\)$/);
  assert.equal(r.mould!.undercuts!.length, 1); assert.ok(r.mould!.undercuts![0].best_share === 1);
  const groove = await build([box(40, 40, 30), ['run_command', { command: 'hole', values: { d: 10, x: 20, y: 20 }, faces: ['n1.top'] }], ['run_command', { command: 'cylinder', values: { r: 8, h: 4, x: 20, y: 20, z: 13 } }], ['run_command', { command: 'difference', values: {}, bodies: ['b2', 'b4'] }]]);
  ({ u } = await rule(groove, [0, 0, 1])); assert.equal(u.status, 'fail'); assert.match(u.message, /freed by no straight action/);
  const plain = await build([box(40, 30, 20)]), sampled = undercuts(plain.bodies, [0, 0, 1]);
  assert.equal(sampled.sampleStep, Math.max(0.05, Math.hypot(40, 30, 20) / 400));
  assert.equal(sampled.coarsestStep, 50 / 64);
  assert.ok(!('stepMM' in sampled) && !('coarsestMM' in sampled));
  ({ u } = await rule(plain, [0, 0, 1])); assert.equal(u.status, 'pass');
  // (O80: a pass says how fine it looked — a 40 × 30 face is two triangles, their 50 mm diagonal capped at 64 parts: 0.781.)
  assert.match(u.message, /^no undercut: .* \(sampled every ≤ 0\.781 mm: an undercut smaller than that may be missed\)$/, u.message);
  ({ u } = await rule(side)); assert.equal(u.status, 'unknown'); assert.match(u.why!, /no pull direction/);
  // (The chat shows the report as its process and each rule's status.)
  assert.equal(summarize('check_printability', JSON.stringify(r), false), `injection: ${r.rules.map(x => `${x.id} ${x.status}`).join(', ')}`);
  assert.match(summarize('check_printability', JSON.stringify(r), false), /undercut warn, parting \w+, tooling \w+$/);
});
