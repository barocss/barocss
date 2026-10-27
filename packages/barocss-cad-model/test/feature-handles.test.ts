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
  const doc = cp.build!(ctx, v), node = doc.nodes.at(-1) as { angle: number; pivot: number[] };
  assert.deepEqual([node.angle, node.pivot], [90, [30, 5, 0]]);
  const [b] = bodiesOf(doc);
  assert.ok(Math.abs(b.volume! - 3000) < 1, String(b.volume));
  assert.deepEqual([b.mesh.bounds.min[0], b.mesh.bounds.max[0]].map(Math.round), [0, 60]);
});

test('Revolve edits with an arc on its angle', () => {
  let doc = withNode(rectanglePart(1, 1, 1), { kind: 'sketch', profile: 'rectangle', min: [10, 0], max: [15, 8] });
  doc = { ...doc, nodes: [doc.nodes[2]] }; doc = withNode(doc, { kind: 'revolve', sketch: 0, axis: 'y', angle: 180 });
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
  assert.ok(Math.abs(bodies[0].volume! - bodies[1].volume!) < 1e-6);
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
  assert.ok(Math.abs(out.reduce((s, b) => s + b.volume!, 0) - 4000) < 1);
  // A click on the top face mirrors up across Z 10.
  const top = ctx.bodies[0].mesh.faces.findIndex(f => f.normal[2] > 0.99), up = m.onPick!(ctx, v, { face: { body: 0, face: top }, edge: null }) as Record<string, unknown>;
  assert.deepEqual([up.plane, up.at], ['xy', 10]);
  assert.equal(m.derive!(ctx, { ...v, plane: 'xz' }, ['plane']).at, 10);
});

test('Patterns can make separate bodies instead of one', () => {
  const ctx = picked(rectanglePart(10, 10, 10));
  const row = bodiesOf(cmd('linear-pattern').build!(ctx, { ...cmd('linear-pattern').defaults!(ctx), spacing: 20, count: 3, result: 'separate' }));
  assert.deepEqual(row.map(b => Math.round(b.mesh.bounds.min[0])).sort((a, b) => a - b), [0, 20, 40]);
  const ring = bodiesOf(cmd('circular-pattern').build!(ctx, { ...cmd('circular-pattern').defaults!(ctx), count: 4, px: 30, py: 5, result: 'separate' }));
  assert.equal(ring.length, 4);
  assert.ok(ring.every(b => Math.abs(b.volume! - 1000) < 1e-6));
});

test('Hole types: to a depth, and counterbored (a wider hole to its depth on the same centre)', () => {
  const doc = rectanglePart(40, 20, 10), bodies = bodiesOf(doc), top = bodies[0].mesh.faces.findIndex(f => f.normal[2] > 0.99);
  const ctx: Ctx = { doc, bodies, selection: { faces: [{ body: 0, face: top }], edges: [], bodies: [] } }, hole = cmd('hole');
  const v = { ...hole.defaults!(ctx), x: 20, y: 10, d: 6 };
  const blind = bodiesOf(hole.build!(ctx, { ...v, type: 'blind', depth: 4 }))[0];
  assert.ok(Math.abs(blind.volume! - (8000 - Math.PI * 9 * 4)) < 0.5, String(blind.volume));
  const cb = hole.build!(ctx, { ...v, type: 'counterbore', cd: 12, ch: 3 });
  assert.deepEqual(cb.nodes.slice(2).map(n => n.kind), ['hole', 'hole']);
  const vol = bodiesOf(cb)[0].volume!;
  assert.ok(Math.abs(vol - (8000 - Math.PI * 9 * 10 - Math.PI * (36 - 9) * 3)) < 0.5, String(vol));
  assert.deepEqual(hole.handles!(ctx, { ...v, type: 'counterbore', cd: 12, ch: 3 }).map(h => h.key), ['x', 'd', 'cd', 'ch']);
  assert.throws(() => hole.build!(ctx, { ...v, type: 'counterbore', cd: 5, ch: 3 }), /wider/);
});

test('Split across any plane: a mitre x + y = at through the middle, its arrow along the normal, two bodies', async () => {
  const { featureLabel, planeText } = await import('../src/engine/doc');
  const ctx = picked(rectanglePart(40, 20, 10)), split = cmd('split');
  const v = split.derive!(ctx, { ...split.defaults!(ctx), axis: 'n', nx: 1, ny: 1, nz: 0 }, ['axis']);
  assert.equal(v.at, 30, 'x + y at the centre (20, 10)');
  const [h] = split.handles!(ctx, v), r = Math.SQRT1_2;
  assert.ok(Math.abs(h.dir[0] - r) < 1e-12 && Math.abs(h.dir[1] - r) < 1e-12 && h.scale === Math.SQRT2);
  assert.deepEqual(h.at.map(x => Math.round(x * 1e9) / 1e9), [20, 10, 5]);
  const doc = split.build!(ctx, v), node = doc.nodes.at(-1)!;
  assert.equal(featureLabel(node, doc.nodes.length - 1, doc.nodes), 'Split X+Y = 30');
  const bodies = bodiesOf(doc);
  assert.equal(bodies.length, 2);
  assert.ok(Math.abs(bodies[0].volume! + bodies[1].volume! - 8000) < 1e-6);
  assert.equal(planeText([1, 0, -0.5]), 'X−0.5Z');
  assert.throws(() => split.build!(ctx, { ...v, nx: 0, ny: 0 }), /must not be zero/);
});

test('Draft: one side face turned about its bottom; every side of an extrusion is its own draft; faces that meet are refused', async () => {
  const { featureLabel } = await import('../src/engine/doc');
  const draft = cmd('draft'), doc = rectanglePart(20, 20, 10), bodies = bodiesOf(doc), mesh = bodies[0].mesh;
  const faceOf = (name: string) => ({ body: 0, face: mesh.faces.find(f => f.name === name)!.index });
  const ctx = (names: string[]): Ctx => ({ doc, bodies, selection: { faces: names.map(faceOf), edges: [], bodies: [] } });
  // (The top face is square to X and Y, not Z: offered with the first pull that takes it; +Z is still refused.)
  assert.equal(draft.available(ctx(['n1.top'])).ok, true); assert.equal(draft.defaults!(ctx(['n1.top'])).pull, 'x');
  assert.throws(() => draft.build!(ctx(['n1.top']), { deg: 10 }), /square to Z/);
  const t = Math.tan(10 * Math.PI / 180);
  const one = draft.build!(ctx(['n1.side0']), { deg: 10 });
  assert.equal(featureLabel(one.nodes.at(-1)!, one.nodes.length - 1, one.nodes), 'Draft 10° × 1');
  assert.ok(Math.abs(bodiesOf(one)[0].volume! - (4000 - 0.5 * 10 * 10 * t * 20)) < 0.01);
  // All four sides: the box's extrusion takes the draft itself (no feature added).
  const all = draft.build!(ctx(['n1.side0', 'n1.side1', 'n1.side2', 'n1.side3']), { deg: 10 });
  assert.equal(all.nodes.length, doc.nodes.length); assert.equal((all.nodes[1] as { draft?: number }).draft, 10);
  assert.ok(Math.abs(bodiesOf(all)[0].volume! - (4000 - 40 * t * 100 + 4 / 3 * t * t * 1000)) < 1e-3);
  const r = evaluateDoc(draft.build!(ctx(['n1.side0', 'n1.side1']), { deg: 10 }), 1);
  assert.ok(!r.ok && /meet along an edge/.test(r.error.detail + r.error.hint), r.ok ? '' : r.error.detail);
});

test('Offset face: the top moved out joins material (the sides run on), moved in takes it off', () => {
  const offset = cmd('offset-face'), doc = rectanglePart(20, 20, 10), bodies = bodiesOf(doc);
  const top = { body: 0, face: bodies[0].mesh.faces.find(f => f.name === 'n1.top')!.index }, ctx: Ctx = { doc, bodies, selection: { faces: [top], edges: [], bodies: [] } };
  const [h] = offset.handles!(ctx, { d: 2 });
  assert.deepEqual([h.key, h.dir], ['d', [0, 0, 1]]);
  const up = bodiesOf(offset.build!(ctx, { d: 3 }));
  assert.equal(up.length, 1); assert.ok(Math.abs(up[0].volume! - 20 * 20 * 13) < 1e-6); assert.equal(up[0].mesh.bounds.max[2], 13);
  const down = bodiesOf(offset.build!(ctx, { d: -4 }));
  assert.ok(Math.abs(down[0].volume! - 20 * 20 * 6) < 1e-6); assert.equal(down[0].mesh.bounds.max[2], 6);
  assert.throws(() => offset.build!(ctx, { d: 0 }), /a distance/);
});
