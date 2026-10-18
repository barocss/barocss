import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, type ModelNode } from '../src/engine/doc';
import { commands, type Ctx, type Values } from '../src/app/commands';
import { editCommand } from '../src/app/editCommand';

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

test('a placed shape edits as itself later: its command, values, arrows and puck, rebuilt in place', () => {
  const sphere = commands.find(c => c.id === 'sphere')!, doc = sphere.build!(ctx, { ...sphere.defaults!(ctx), r: 10, x: 0, y: 0, z: 0 });
  const edit = editCommand(1, doc.nodes)!, bodies = (evaluateDoc(doc, 1) as { bodies: BodyResult[] }).bodies;
  const ectx: Ctx = { doc, bodies, selection: { faces: [], edges: [], bodies: [0] } };
  assert.equal(edit.label, 'Edit Sphere');
  assert.deepEqual(edit.handles!(ectx, edit.defaults!(ectx)).map(h => h.key), ['x', 'r']);
  const next = edit.build!(ectx, { ...edit.defaults!(ectx), r: 15, x: 30 });
  assert.equal(next.nodes.length, 2);
  assert.deepEqual([(next.nodes[1] as { made: { values: Values } }).made.values.r, (next.nodes[1] as { made: { values: Values } }).made.values.x], [15, 30]);
  close((evaluateDoc(next, 2) as { bodies: BodyResult[] }).bodies[0].volumeMM3!, 4 / 3 * Math.PI * 15 ** 3);
  // Changed by hand since (the revolve's angle): its own fields instead.
  const hand = { ...doc, nodes: [doc.nodes[0], { ...doc.nodes[1], angleDegrees: 180 } as ModelNode] };
  assert.notEqual(editCommand(1, hand.nodes)?.label, 'Edit Sphere');
});

test('Shell has a wall arrow when made and when edited', () => {
  const box = commands.find(c => c.id === 'box')!, doc = box.build!(ctx, { ...box.defaults!(ctx), x: 0, y: 0, z: 0 });
  const b0 = (evaluateDoc(doc, 1) as { bodies: BodyResult[] }).bodies, top = b0[0].mesh.faces.findIndex(f => f.normal[2] > 0.99);
  const shell = commands.find(c => c.id === 'shell')!, sctx: Ctx = { doc, bodies: b0, selection: { faces: [{ body: 0, face: top }], edges: [], bodies: [] } };
  const [h] = shell.handles!(sctx, { t: 2 });
  assert.deepEqual([h.key, h.dir], ['t', [-0, -0, -1]]);
  const shelled = shell.build!(sctx, { t: 2 }), b1 = (evaluateDoc(shelled, 2) as { bodies: BodyResult[] }).bodies;
  const edit = editCommand(2, shelled.nodes)!, ectx: Ctx = { doc: shelled, bodies: b1, selection: { faces: [], edges: [], bodies: [0] } };
  const [eh] = edit.handles!(ectx, edit.defaults!(ectx));
  assert.equal(eh.key, 't');
});

test('a shape placed on a side face stands out of it: turned about where it was placed; arrows and puck turn too', () => {
  const cyl = commands.find(c => c.id === 'cylinder')!, v0 = cyl.defaults!(ctx);
  // On a +X face at x = 20, centred at (y 5, z 4): the bar runs along +X from there.
  const v = cyl.place!({ ...v0, r: 3, h: 10 }, [20, 5, 4], [1, 0, 0]);
  assert.equal(v.up, '+x');
  const doc = cyl.build!(ctx, v), [b] = (evaluateDoc(doc, 1) as { bodies: BodyResult[] }).bodies;
  assert.deepEqual([...b.mesh.bounds.min, ...b.mesh.bounds.max].map(x => Math.round(x * 100) / 100), [20, 2, 1, 30, 8, 7]);
  const hs = cyl.handles!(ctx, v);
  assert.deepEqual(hs.map(h => h.key), ['y', 'r', 'h']);
  assert.deepEqual([hs[0].pair?.key, hs[2].dir], ['z', [1, 0, 0]]);
  // It edits as itself, turned the same way.
  const edit = editCommand(doc.nodes.length - 1, doc.nodes)!;
  assert.equal(edit.label, 'Edit Cylinder');
  const longer = edit.build!({ ...ctx, doc }, { ...edit.defaults!({ ...ctx, doc }), h: 16 });
  assert.equal(Math.round((evaluateDoc(longer, 2) as { bodies: BodyResult[] }).bodies[0].mesh.bounds.max[0]), 36);
  // Under a face (−Z) a box hangs down from it.
  const box = commands.find(c => c.id === 'box')!, bv = box.place!({ ...box.defaults!(ctx), w: 10, d: 10, h: 4 }, [0, 0, 8], [0, 0, -1]);
  const [hb] = (evaluateDoc(box.build!(ctx, bv), 3) as { bodies: BodyResult[] }).bodies;
  assert.deepEqual([hb.mesh.bounds.min[2], hb.mesh.bounds.max[2]].map(Math.round), [4, 8]);
});

test('SubD torus (SD1, D51): a subd node from a regular cage — a smooth ring near the asked radii, curved B-spline faces, editable as values', () => {
  const ring = make('subd-torus', { R: 20, r: 6, nu: 16, nv: 8, x: 0, y: 0, z: 0 });
  // The limit over the cage's vertices sits at the radii (across the tube within 1 − cu of r): near a true torus.
  const exact = 2 * Math.PI * Math.PI * 20 * 36;
  assert.ok(Math.abs(ring.volumeMM3! / exact - 1) < 0.03, `${ring.volumeMM3} vs ${exact}`);
  assert.ok(Math.abs(ring.mesh.bounds.max[2] - 12) < 0.05 && Math.abs(ring.mesh.bounds.min[2]) < 0.05, JSON.stringify(ring.mesh.bounds));
  const cmd = commands.find(c => c.id === 'subd-torus')!, doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), nu: 24, nv: 12 });
  const node = doc.nodes[0] as Extract<ModelNode, { kind: 'subd' }>;
  assert.deepEqual([node.kind, node.cage.faces.length, node.cage.positions.length], ['subd', 288, 864]);
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  assert.ok(r.bodies[0].mesh.faces.every(f => /^n0\.patch\d+$/.test(f.name)), r.bodies[0].mesh.faces.map(f => f.name).join(' '));
  assert.throws(() => cmd.build!(ctx, { ...cmd.defaults!(ctx), R: 5, r: 6 }), /smaller/);
});
