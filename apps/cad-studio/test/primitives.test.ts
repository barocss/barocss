import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';

const ctx: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
function make(id: string, values: Record<string, number> = {}) {
  const cmd = commands.find(c => c.id === id)!;
  assert.ok(cmd.available(ctx).ok, id);
  const doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), ...values }), r = evaluateDoc(doc, 1);
  assert.ok(r.ok, r.ok ? '' : `${id}: ${r.error.title} ${r.error.hint}`);
  assert.equal(r.bodies.length, 1, id);
  return r.bodies[0];
}
const close = (a: number, b: number, rel = 2e-3) => assert.ok(Math.abs(a - b) <= rel * b, `${a} vs ${b}`);

test('primitive solids: sizes and volumes as asked, standing on At Z at the centre', () => {
  const sphere = make('sphere', { r: 10, x: 5, y: 6, z: 2 });
  close(sphere.volumeMM3!, 4 / 3 * Math.PI * 1000);
  assert.deepEqual(sphere.mesh.bounds.min.map(Math.round), [-5, -4, 2]);
  assert.deepEqual(sphere.mesh.bounds.max.map(Math.round), [15, 16, 22]);
  close(make('cone', { r: 10, rt: 0, h: 20 }).volumeMM3!, Math.PI * 100 * 20 / 3);
  close(make('cone', { r: 10, rt: 4, h: 20 }).volumeMM3!, Math.PI * 20 / 3 * (100 + 40 + 16));
  const torus = make('torus', { R: 20, r: 5, z: 0 });
  close(torus.volumeMM3!, 2 * Math.PI * Math.PI * 20 * 25);
  assert.deepEqual([torus.mesh.bounds.min[2], torus.mesh.bounds.max[2]].map(Math.round), [0, 10]);
  close(make('tube', { r: 10, ri: 6, h: 24 }).volumeMM3!, Math.PI * (100 - 36) * 24);
  const wedge = make('wedge', { w: 32, d: 16, h: 16, x: 0, y: 0, z: 0 });
  close(wedge.volumeMM3!, 32 * 16 / 2 * 16);
  assert.deepEqual([...wedge.mesh.bounds.min, ...wedge.mesh.bounds.max].map(Math.round), [0, 0, 0, 32, 16, 16]);
  const hex = make('prism', { n: 6, s: 16, h: 10, x: 0, y: 0 });
  close(hex.volumeMM3!, 2 * Math.sqrt(3) * 64 * 10);
  assert.deepEqual([hex.mesh.bounds.min[1], hex.mesh.bounds.max[1]].map(v => Math.round(v * 1000) / 1000), [-8, 8]);
  close(make('prism', { n: 12, s: 20, h: 5 }).volumeMM3!, 12 * Math.tan(Math.PI / 12) * 100 * 5);
});

test('primitive sizes that cannot be made say why', () => {
  for (const [id, v] of [['torus', { R: 5, r: 6 }], ['tube', { r: 5, ri: 6 }]] as const) {
    const cmd = commands.find(c => c.id === id)!;
    assert.throws(() => cmd.build!(ctx, { ...cmd.defaults!(ctx), ...v }), /smaller/);
  }
});
