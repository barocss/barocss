import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { wallSamples } from '../src/analysis/analysis';
import { draftField } from '../src/mould/draft';
import { nearestDistance2, triangleBvh } from '@barocss/cad';

// IM8 S0 (O104): what casting can read exactly today, against closed forms — a section's modulus V/A from exact
// volume and area, and Chvorinov's ratio of solidification times (M1/M2)², which says which section freezes last; the
// hot spot of an L junction, its inscribed circle 2t(2 − √2) ≈ 1.17 t against a wall of t (IM4's local thickness); a
// pattern's shrink allowance from a public table's inches per foot; die-casting draft per alloy (Dynacast's 0.5° zinc,
// 1–2° aluminium) on IM2's exact draft field.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][]): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of calls) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
/** A body's surface area from its display triangles (exact for planar bodies). */
function areaOf(b: BodyResult): number {
  const P = b.mesh.positions, I = b.mesh.indices; let A = 0;
  for (let t = 0; t < I.length; t += 3) {
    const i0 = 3 * I[t], i1 = 3 * I[t + 1], i2 = 3 * I[t + 2], ux = P[i1] - P[i0], uy = P[i1 + 1] - P[i0 + 1], uz = P[i1 + 2] - P[i0 + 2], vx = P[i2] - P[i0], vy = P[i2 + 1] - P[i0 + 1], vz = P[i2 + 2] - P[i0 + 2];
    A += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return A;
}

test('IM8 S0 P1: the casting modulus V/A — a 100 × 100 × 10 plate 100000/24000 = 4.1667, a 20 mm cube 20/6 = 3.3333; Chvorinov (M1/M2)² = 1.5625: the plate freezes last', async () => {
  const plate = (await build([cmd('box', { w: 100, d: 100, h: 10, x: 0, y: 0, z: 0 })])).bodies[0], cube = (await build([cmd('box', { w: 20, d: 20, h: 20, x: 0, y: 0, z: 0 })])).bodies[0];
  const M = (b: BodyResult) => b.volume! / areaOf(b);
  assert.ok(Math.abs(M(plate) - 100000 / 24000) <= 1e-9 && Math.abs(M(cube) - 20 / 6) <= 1e-9, `${M(plate)} ${M(cube)}`);
  assert.ok(Math.abs((M(plate) / M(cube)) ** 2 - 1.5625) <= 1e-9);
});

test('IM8 S0 P2: the hot spot of an L junction (walls 4, a sharp inside corner): IM4\'s per-face inscribed sphere reads 4 everywhere — it misses it; the largest ball on the corner\'s bisector, by the kernel\'s exact nearest distance, 2r = 2t(2 − √2) = 4.686', async () => {
  const t = 4, s = await build([cmd('box', { w: 60, d: 30, h: t, x: 0, y: 0, z: 0 }), cmd('box', { w: t, d: 30, h: 60, x: 0, y: 0, z: 0 }), ['run_command', { command: 'union', values: {}, bodies: ['b1', 'b3'] }]]);
  const w = wallSamples(s.bodies[0]); let max = 0;
  for (let k = 0; k < w.local.length; k++) if (w.area[k] > 0 && Number.isFinite(w.local[k]) && w.local[k] > max) max = w.local[k];
  assert.ok(Math.abs(max - t) <= 1e-6, `IM4 reads ${max}: the junction's ball is on no face's ray`);
  // (Along the bisector from the outer corner (0, y, 0) at mid-length: the distance to the boundary rises, then falls past the ball's centre.)
  // (The kernel's nearest query, K2–K4's one point–triangle distance.)
  const m = s.bodies[0].mesh, bvh = triangleBvh(m.positions, m.indices), dist = (p: number[]) => Math.sqrt(nearestDistance2(bvh, p[0], p[1], p[2]));
  let best = 0; for (let k = 1; k < 4000; k++) { const u = t * k / 4000; best = Math.max(best, dist([u, 15, u])); }
  assert.ok(Math.abs(2 * best - 2 * t * (2 - Math.SQRT2)) <= 2e-3, String(2 * best));
});

test('IM8 S0 P3: a pattern\'s shrink allowance — aluminium up to 4 ft, 0.155 in/ft (NPTEL\'s table): 100 mm cast is 100 · (1 + 0.155/12) = 101.2917 on the pattern; cast steel up to 2 ft, 0.251 in/ft: 102.0917', () => {
  const pattern = (mm: number, inPerFt: number) => mm * (1 + inPerFt / 12);
  assert.ok(Math.abs(pattern(100, 0.155) - 101.291667) <= 1e-6); assert.ok(Math.abs(pattern(100, 0.251) - 102.091667) <= 1e-6);
});

test('IM8 S0 P4: die-casting draft per alloy on IM2\'s exact field — a block drafted 0.75°: zinc\'s 0.5° met, aluminium\'s 1° not', async () => {
  const doc = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }), { kind: 'extrude', sketch: 0, height: 20, draft: 0.75 });
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  const sides = (minDeg: number) => draftField(doc, r.bodies, [0, 0, 1], minDeg).faces.filter(f => f.kind !== 'plane' || Math.abs(f.max) < 89);
  const least = Math.min(...sides(0.5).filter(f => f.steepest < 89).map(f => f.steepest));
  assert.ok(Math.abs(least - 0.75) <= 1e-6, String(least));
  assert.ok(least >= 0.5 - 1e-9, 'zinc: 0.5° met'); assert.ok(least < 1 - 1e-9, 'aluminium: 1° not');
});
