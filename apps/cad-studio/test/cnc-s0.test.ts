import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { buildBvh, rayHit } from '../src/print/orient';
import { exactNormals } from '../src/mould/draft';
import { wallsOf } from '../src/mould/walls';
import { faceTableOf } from '../src/assembly/faces';

// CNC S0 (O83): what the machining track can measure exactly today, against closed forms and constructed cases, with
// no kernel-core change — a pocket's corner radius and depth (exact cylinders and planes), six-direction access and a
// greedy setup count (rays through the studio's BVH, as IM3's), a hole's depth over its diameter (exact cylinders), and
// turning's axisymmetry (every exact normal meets the axis: n · (a × (p − c)) = 0). The findings are in O83.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][]): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of calls) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
type V = [number, number, number];
const SIX: V[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** Each triangle's centre (0.01 mm off it), seen along each of the six directions: a bit per direction. */
function access(b: BodyResult): { seen: Uint8Array; area: Float64Array } {
  const m = b.mesh, P = m.positions, I = m.indices, T = I.length / 3, bvh = buildBvh(m), seen = new Uint8Array(T), area = new Float64Array(T);
  for (let t = 0; t < T; t++) {
    const p = [0, 1, 2].map(k => [0, 1, 2].map(j => P[3 * I[3 * t + k] + j])), u = p[1].map((v, j) => v - p[0][j]), w = p[2].map((v, j) => v - p[0][j]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(n[0], n[1], n[2]); if (!(l > 0)) continue;
    area[t] = l / 2; const c = [0, 1, 2].map(j => (p[0][j] + p[1][j] + p[2][j]) / 3 + 0.01 * n[j] / l);
    SIX.forEach((d, k) => { if (rayHit(bvh, c, d) === Infinity) seen[t] |= 1 << k; });
  }
  return { seen, area };
}
/** Greedy setups: the direction that sees the most unseen area, until all that can be seen is. */
function setups(a: { seen: Uint8Array; area: Float64Array }): number[] {
  const left = new Set(Array.from(a.seen.keys()).filter(t => a.seen[t] && a.area[t] > 0)), out: number[] = [];
  while (left.size) {
    let best = -1, bestA = 0;
    for (let k = 0; k < 6; k++) { let A = 0; for (const t of left) if (a.seen[t] & (1 << k)) A += a.area[t]; if (A > bestA) { bestA = A; best = k; } }
    out.push(best); for (const t of [...left]) if (a.seen[t] & (1 << best)) left.delete(t);
  }
  return out;
}

test('CNC S0 P1: a plate\'s pocket — its four vertical corner radii exact (r 5) and its depth by exact planes (8): against Hubs\' "larger than ⅓ x pocket depth", 5 ≥ 2.667', async () => {
  const s = await build([cmd('box', { w: 120, d: 80, h: 12, x: 0, y: 0, z: 0 }), cmd('box', { w: 50, d: 30, h: 9, x: 35, y: 25, z: 4 }), cmd('difference', {}, { bodies: ['b1', 'b3'] }),
    cmd('fillet', { radius: 5 }, { edges: [0, 1, 2, 3].map(k => ({ between: [`n3.side${k}`, `n3.side${(k + 1) % 4}`] })) })]);
  const [w] = wallsOf(s.doc, s.bodies, 0.6);
  assert.deepEqual(w.fillets.map(f => +f.radiusMM.toFixed(9)), [5, 5, 5, 5]);
  const floor = s.bodies[0].mesh.faces.filter(f => f.exact?.kind === 'plane' && Math.abs(f.exact.n[2] - 1) < 1e-12 && f.exact.o[2] < 12 - 1e-9).map(f => (f.exact as { o: V }).o[2]);
  assert.deepEqual(floor, [4]); assert.ok(5 >= (12 - 4) / 3);
});

test('CNC S0 P2: six-direction access — a block with a side hole: every face seen, a greedy count of two setups (rays along a face count it seen: side milling); an internal groove: seen from none', async () => {
  let s = await build([cmd('box', { w: 40, d: 30, h: 20, x: 0, y: 0, z: 0 }), cmd('hole', { d: 6, x: 20, y: 10 }, { faces: [{ normal: [0, -1, 0], pick: 'max' }] })]);
  const a = access(s.bodies[0]);
  assert.ok([...a.seen.keys()].every(t => a.seen[t] || !(a.area[t] > 0)), 'every triangle seen from one of the six');
  const bore = new Set(s.bodies[0].mesh.faces.filter(f => f.exact?.kind === 'cylinder').map(f => f.index)), m = s.bodies[0].mesh;
  for (let t = 0; t < m.indices.length / 3; t++) if (bore.has(m.faceOfVertex[m.indices[3 * t]]) && a.area[t] > 0) assert.ok(a.seen[t] & (1 << 2) || a.seen[t] & (1 << 3), 'the bore along ±Y');
  assert.equal(setups(a).length, 2, 'two setups: one sees all but one side, the next that side');
  s = await build([cmd('box', { w: 40, d: 40, h: 30, x: 0, y: 0, z: 0 }), cmd('hole', { d: 10, x: 20, y: 20 }, { faces: ['n1.top'] }), cmd('cylinder', { r: 8, h: 4, x: 20, y: 20, z: 13 }), cmd('difference', {}, { bodies: ['b2', 'b4'] })]);
  const g = access(s.bodies[0]), gm = s.bodies[0].mesh;
  let hidden = 0; for (let t = 0; t < gm.indices.length / 3; t++) if (!g.seen[t] && g.area[t] > 0) hidden += g.area[t];
  assert.ok(hidden > 0, 'the groove seen from none of the six');
});

test('CNC S0 P3: a hole\'s depth over its diameter from exact cylinders — Ø5, 30 deep: 6, Hubs\' "Maximum depth: 6 x nominal diameter"', async () => {
  const s = await build([cmd('box', { w: 30, d: 30, h: 40, x: 0, y: 0, z: 0 }), cmd('hole', { type: 'blind', d: 5, depth: 30, x: 15, y: 15 }, { faces: ['n1.top'] })]);
  const t = faceTableOf(s.doc), bore = Object.values(t).find(f => f.kind === 'cylinder' && !f.outer)!;
  assert.ok(bore && bore.kind === 'cylinder' && Math.abs(bore.radius - 2.5) <= 1e-12);
  const m = s.bodies[0].mesh, f = m.faces.find(x => x.exact?.kind === 'cylinder')!;
  let lo = Infinity, hi = -Infinity; for (let i = 0; i < m.faceOfVertex.length; i++) if (m.faceOfVertex[i] === f.index) { lo = Math.min(lo, m.positions[3 * i + 2]); hi = Math.max(hi, m.positions[3 * i + 2]); }
  assert.ok(Math.abs((hi - lo) / 5 - 6) <= 1e-6, String((hi - lo) / 5));
});

test('CNC S0 P4: turning\'s axisymmetry — a drafted cylinder (a cone and its end planes) about Z: every exact normal meets the axis to 1e-9; a box does not', async () => {
  let doc = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 12 }), { kind: 'extrude', sketch: 0, height: 20, draft: 5 });
  const meet = (d: StudioDoc) => {
    const r = evaluateDoc(d, 1); assert.ok(r.ok); const b = r.bodies[0], N = exactNormals(d, b), m = b.mesh; let worst = 0;
    for (let i = 0; i < m.faceOfVertex.length; i++) {
      const p = [m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]], n = N(m.faceOfVertex[i], p), q = [-p[1], p[0], 0];
      const l = Math.hypot(q[0], q[1]); if (l < 1e-6) continue;
      worst = Math.max(worst, Math.abs((n[0] * q[0] + n[1] * q[1]) / l));
    }
    return worst;
  };
  assert.ok(meet(doc) <= 1e-9, String(meet(doc)));
  doc = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [-10, -10], max: [10, 10] }), { kind: 'extrude', sketch: 0, height: 20 });
  assert.ok(meet(doc) > 0.5, 'a box\'s side faces do not face the axis');
});
