import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { editCommand } from '../src/app/editCommand';

const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.title); return r.bodies; };
const cmd = (id: string) => commands.find(c => c.id === id)!;
const picked = (doc: StudioDoc): Ctx => ({ doc, bodies: bodiesOf(doc), selection: { faces: [], edges: [], bodies: [0] } });

test('Split: an arrow on its plane, held inside the body; a new normal starts in the middle', () => {
  const ctx = picked(rectanglePart(40, 20, 10)), split = cmd('split'), v = split.defaults!(ctx);
  const [h] = split.handles!(ctx, v);
  assert.deepEqual([h.key, h.at, h.dir, h.min, h.max], ['at', [20, 10, 5], [1, 0, 0], 0.5, 39.5]);
  assert.equal(split.derive!(ctx, { ...v, axis: 'z' }, ['axis']).at, 5);
});

test('Linear pattern: spacing at the second copy, count past the last, made and edited', () => {
  const ctx = picked(rectanglePart(10, 10, 10)), lp = cmd('linear-pattern'), v = { ...lp.defaults!(ctx), spacing: 20, count: 3 };
  const [s, n] = lp.handles!(ctx, v);
  assert.deepEqual([s.key, s.at[0], n.key, n.at[0], n.scale], ['spacing', 25, 'count', 50, 1 / 20]);
  const doc = lp.build!(ctx, v), edit = editCommand(2, doc.nodes)!, ectx = picked(doc);
  const [es, en] = edit.handles!(ectx, edit.defaults!(ectx));
  assert.deepEqual([es.key, es.at[0], en.key, en.at[0]], ['spacing', 25, 'count', 50]);
});

test('Circular pattern about a moved axis: copies spread over an angle; a puck and an arc', () => {
  const ctx = picked(rectanglePart(10, 10, 10)), cp = cmd('circular-pattern'), v = { ...cp.defaults!(ctx), count: 3, span: 180, px: 30, py: 5 };
  const hs = cp.handles!(ctx, v);
  assert.deepEqual(hs.map(h => h.key), ['px', 'span']);
  const doc = cp.build!(ctx, v), node = doc.nodes.at(-1) as { angleDegrees: number; pivot: number[] };
  assert.deepEqual([node.angleDegrees, node.pivot], [90, [30, 5, 0]]);
  const [b] = bodiesOf(doc);
  assert.ok(Math.abs(b.volumeMM3! - 3000) < 1, String(b.volumeMM3));
  assert.deepEqual([b.mesh.bounds.min[0], b.mesh.bounds.max[0]].map(Math.round), [0, 60]);
});

test('Revolve edits with an arc on its angle', () => {
  let doc = withNode(rectanglePart(1, 1, 1), { kind: 'sketch', profile: 'rectangle', min: [10, 0], max: [15, 8] });
  doc = { ...doc, nodes: [doc.nodes[2]] }; doc = withNode(doc, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 180 });
  const edit = editCommand(1, doc.nodes)!, [h] = edit.handles!(picked(doc), edit.defaults!(picked(doc)));
  assert.equal(h.key, 'deg'); assert.ok(h.arc);
});

test('Duplicate copies a body with all its features as a body of its own, moved and coloured alike', () => {
  let doc = withNode(rectanglePart(20, 20, 10), { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 3 });
  doc = { ...doc, bodies: { b1: { color: '#4a90d9', name: 'Base' } } };
  const ctx = picked(doc), dup = cmd('duplicate'), v = dup.defaults!(ctx);
  assert.equal(v.dx, 30);
  const out = dup.build!(ctx, v), bodies = bodiesOf(out);
  assert.equal(bodies.length, 2);
  assert.ok(Math.abs(bodies[0].volumeMM3! - bodies[1].volumeMM3!) < 1e-6);
  const copy = bodies.find(b => b.mesh.bounds.min[0] > 25)!;
  assert.deepEqual([copy.mesh.bounds.min[0], copy.mesh.bounds.max[0]].map(Math.round), [30, 50]);
  assert.deepEqual((out.nodes[5] as { edges: string[] }).edges, ['n4.side0|n4.top']);
  assert.deepEqual(out.bodies, { b1: { color: '#4a90d9', name: 'Base' }, b4: { color: '#4a90d9' } });
});

test('Mirror across a face’s plane (not only the origin’s): by default its own +X face', () => {
  const ctx = picked(rectanglePart(20, 10, 10)), m = cmd('mirror'), v = m.defaults!(ctx);
  assert.deepEqual([v.plane, v.at], ['yz', 20]);
  const out = bodiesOf(m.build!(ctx, v)), lo = Math.min(...out.map(b => b.mesh.bounds.min[0])), hi = Math.max(...out.map(b => b.mesh.bounds.max[0]));
  assert.deepEqual([lo, hi].map(Math.round), [0, 40]);
  assert.ok(Math.abs(out.reduce((s, b) => s + b.volumeMM3!, 0) - 4000) < 1);
  // A click on the top face mirrors up across Z 10.
  const top = ctx.bodies[0].mesh.faces.findIndex(f => f.normal[2] > 0.99), up = m.onPick!(ctx, v, { face: { body: 0, face: top }, edge: null }) as Record<string, unknown>;
  assert.deepEqual([up.plane, up.at], ['xy', 10]);
  assert.equal(m.derive!(ctx, { ...v, plane: 'xz' }, ['plane']).at, 10);
});
