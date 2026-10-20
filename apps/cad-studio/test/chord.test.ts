import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { chordOf, verdictOf } from '../src/chat/references';
import type { DisplayMesh } from '../src/engine/mesh';

// O55: A6.3's chord tolerance, bounded from the tessellation's own steps in both directions. On a sphere and a torus the
// new δ is at least the mesh's true worst depth below the exact surface (sampled over every triangle) and not far
// above it; the old δ (an edge's sagitta at the face's radius) was half that on the sphere — a keep-out it called
// clear is one the true surface violates, and the new δ calls it undecided. The torus, unbounded before, is decided.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function body(tool: string, args: object) { const r = await dispatchTool({ doc: emptyDoc(), bodies: [] }, tool, args as Record<string, unknown>, evaluate); assert.ok(!r.isError, r.content); const e = await evaluate(r.state.doc); assert.ok(e.ok); return { doc: r.state.doc, bodies: e.bodies }; }
/** The mesh's worst depth below an exact surface (signed distance: positive inside), sampled at 45 points a triangle; and the triangle. */
function trueDepth(m: DisplayMesh, inside: (p: number[]) => number): { depth: number; at: number[] } {
  let depth = 0, at = [0, 0, 0];
  for (let t = 0; t < m.indices.length; t += 3) {
    const P = [0, 1, 2].map(j => [0, 1, 2].map(q => m.positions[m.indices[t + j] * 3 + q]));
    for (let i = 0; i <= 8; i++) for (let j = 0; i + j <= 8; j++) { const a = i / 8, b = j / 8, c = 1 - a - b, p = [0, 1, 2].map(q => a * P[0][q] + b * P[1][q] + c * P[2][q]), d = inside(p); if (d > depth) { depth = d; at = p; } }
  }
  return { depth, at };
}

test('the sphere R 15: the new δ covers the mesh\'s true depth (the old was half of it); a keep-out the old δ called clear, the true sphere violates — the new δ says undecided', async () => {
  const { doc, bodies } = await body('run_command', { command: 'sphere', values: { r: 15, x: 0, y: 0, z: 0 } }), m = bodies[0].mesh, R = 15, c = [0, 0, 15];
  const truth = trueDepth(m, p => R - Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])), next = chordOf(m), old = R * (1 - Math.cos(Math.PI / 32));
  console.log(`O55 sphere: true depth ${truth.depth.toFixed(5)}, old δ ${old.toFixed(5)}, new δ ${next.toFixed(5)}`);
  assert.ok(old < truth.depth, 'the old δ under the true depth: the bug');
  assert.ok(next >= truth.depth - 1e-9 && next <= 1.5 * truth.depth, `${next} vs ${truth.depth}`);
  // (A keep-out's face square to the deepest point's direction u at R + g: the true gap is g; the mesh's gap is g plus that
  // triangle's depth. The required clearance halfway between the old δ and the new below the mesh's gap.)
  const u = [0, 1, 2].map(q => truth.at[q] - c[q]), lu = Math.hypot(...u); for (let q = 0; q < 3; q++) u[q] /= lu;
  const x = Math.abs(u[2]) < 0.9 ? [u[1], -u[0], 0] : [0, u[2], -u[1]], lx = Math.hypot(...x); for (let q = 0; q < 3; q++) x[q] /= lx;
  const y = [u[1] * x[2] - u[2] * x[1], u[2] * x[0] - u[0] * x[2], u[0] * x[1] - u[1] * x[0]], g = 2;
  const origin = [0, 1, 2].map(q => c[q] + (R + g) * u[q] - 5 * x[q] - 5 * y[q]);
  const s: ChatState = { doc, bodies };
  const probe = await dispatchTool(s, 'add_keepout', { name: 'near', box: { frame: { origin, normal: u, xAxis: x }, size: [10, 10, 10] } }, evaluate); assert.ok(!probe.isError, probe.content);
  const read = async (st: ChatState) => JSON.parse((await dispatchTool(st, 'check_keepouts', {}, evaluate)).content).results[0] as { verdict: string; clearance_mm: number; chord_tolerance_mm: number };
  const d = (await read(probe.state)).clearance_mm, required = d - (old + next) / 2;
  // (The mesh lies below the sphere by at most δ: its gap between the true gap and that plus δ, near the top of it here.)
  assert.ok(d >= g - 1e-9 && d <= g + next + 1e-9 && d - g > old, `the mesh's gap ${d}`);
  assert.equal(verdictOf(0, d, required, old).verdict, 'clear', 'the old δ: clear');
  assert.ok(g < required, `while the true sphere is ${g} mm from it, under the ${required} asked: violated`);
  const withReq = await dispatchTool(s, 'add_keepout', { name: 'near', box: { frame: { origin, normal: u, xAxis: x }, size: [10, 10, 10] }, clearance: required }, evaluate);
  const k = await read(withReq.state);
  assert.equal(k.verdict, 'undecided', JSON.stringify(k)); assert.ok(Math.abs(k.chord_tolerance_mm - next) < 1e-3);
});

test('the torus (R 20, r 5): unbounded before, now a finite δ at least the true depth; a keep-out clearly clear is decided, one within δ undecided', async () => {
  const { doc, bodies } = await body('add_features', { features: [{ kind: 'sketch', profile: 'circle', center: [20, 0], radius: 5 }, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 }] }), m = bodies[0].mesh;
  // (Revolved about Y: the tube's centre circle radius 20 in the XZ plane.)
  const truth = trueDepth(m, p => 5 - Math.hypot(Math.hypot(p[0], p[2]) - 20, p[1])), next = chordOf(m);
  console.log(`O55 torus: true depth ${truth.depth.toFixed(5)}, new δ ${next.toFixed(5)} (before: unbounded)`);
  assert.ok(Number.isFinite(next) && next >= truth.depth - 1e-9 && next <= 2 * truth.depth, `${next} vs ${truth.depth}`);
  const s: ChatState = { doc, bodies };
  const far = await dispatchTool(s, 'add_keepout', { name: 'above', box: { frame: { origin: [-5, 7, -5], normal: [0, 1, 0], xAxis: [1, 0, 0] }, size: [10, 10, 10] }, clearance: 1 }, evaluate);
  const kf = JSON.parse((await dispatchTool(far.state, 'check_keepouts', {}, evaluate)).content).results[0];
  assert.equal(kf.verdict, 'clear', JSON.stringify(kf));
  const tight = await dispatchTool(s, 'add_keepout', { name: 'above', box: { frame: { origin: [15, 7, -5], normal: [0, 1, 0], xAxis: [1, 0, 0] }, size: [10, 10, 10] }, clearance: 2 }, evaluate);
  const kt = JSON.parse((await dispatchTool(tight.state, 'check_keepouts', {}, evaluate)).content).results[0];
  // (The tube's top at y 5 under the box's face at y 7: 2 mm, the clearance asked, within δ.)
  assert.equal(kt.verdict, 'undecided', JSON.stringify(kt));
});
