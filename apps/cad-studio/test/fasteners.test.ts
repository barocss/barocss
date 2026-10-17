import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { editCommand } from '../src/app/editCommand';
import { FASTENER_SIZES, fastenerName, fastenerThread } from '../src/app/fasteners';

const ctx: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const f = commands.find(c => c.id === 'fastener')!;
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.title + ' ' + r.error.hint); return r.bodies; };
const near = (a: number, b: number, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('fastener catalogue: M8 coarse pitch, ISO 4017 head, ISO 4032 nut, ISO 7089 washer', () => {
  const m8 = FASTENER_SIZES.M8;
  assert.deepEqual([m8.pitch, m8.s, m8.k, m8.m, m8.wd1, m8.wd2, m8.wh], [1.25, 13, 5.3, 6.8, 8.4, 16, 1.6]);
  assert.equal(fastenerName({ kind: 'hex-bolt', size: 'M8', length: '30' }), 'Hex head bolt ISO 4017 M8×1.25 × 30');
  assert.deepEqual(fastenerThread({ kind: 'hex-nut', size: 'M8' }), { d: 8, pitch: 1.25, hand: 'right', length: 6.8, internal: true });
  assert.equal(fastenerThread({ kind: 'washer', size: 'M8' }), null);
});

test('a hex bolt stands on its seat: head above, shank below; volumes of each part', () => {
  const doc = f.build!(ctx, { ...f.defaults!(ctx), kind: 'hex-bolt', size: 'M8', length: '30', x: 0, y: 0, z: 10 });
  const [b] = bodiesOf(doc), m8 = FASTENER_SIZES.M8, hex = 3 * Math.sqrt(3) / 2 * (m8.s / Math.sqrt(3)) ** 2;
  near(b.volumeMM3!, hex * m8.k + Math.PI * 16 * 30, 1);
  assert.deepEqual([b.mesh.bounds.min[2], b.mesh.bounds.max[2]].map(v => Math.round(v * 10) / 10), [-20, 15.3]);
  assert.equal(featureLabel(doc.nodes.at(-1)!, doc.nodes.length - 1, doc.nodes), 'Bolt M8×30');
  for (const kind of ['socket-screw', 'hex-nut', 'washer']) assert.equal(bodiesOf(f.build!(ctx, { ...f.defaults!(ctx), kind, size: 'M6', length: '20', x: 0, y: 0, z: 0 })).length, 1, kind);
  const nut = bodiesOf(f.build!(ctx, { ...f.defaults!(ctx), kind: 'hex-nut', size: 'M10', x: 0, y: 0, z: 0 }))[0], m10 = FASTENER_SIZES.M10;
  near(nut.volumeMM3!, (3 * Math.sqrt(3) / 2 * (m10.s / Math.sqrt(3)) ** 2 - Math.PI * 25) * m10.m, 1);
});

test('a placed bolt edits as itself (five steps rebuilt in place); lengths follow the size', () => {
  const doc = f.build!(ctx, { ...f.defaults!(ctx), size: 'M6', length: '20', x: 0, y: 0, z: 0 });
  const edit = editCommand(doc.nodes.length - 1, doc.nodes)!, ectx: Ctx = { doc, bodies: bodiesOf(doc), selection: { faces: [], edges: [], bodies: [0] } };
  assert.equal(edit.label, 'Edit Fastener');
  const next = edit.build!(ectx, { ...edit.defaults!(ectx), size: 'M8', length: '40' });
  assert.equal(next.nodes.length, doc.nodes.length);
  assert.equal(bodiesOf(next)[0].mesh.bounds.min[2], -40);
  assert.equal(f.derive!(ctx, { ...f.defaults!(ctx), size: 'M3', length: '80' }, ['size']).length, '30');
  assert.throws(() => f.build!(ctx, { ...f.defaults!(ctx), size: 'M3', length: '80' }), /come 5–30 mm long/);
});

test('a bolt edited into a nut: fewer steps, and the features after it follow', async () => {
  const { withNode } = await import('../src/engine/doc');
  let doc = f.build!(ctx, { ...f.defaults!(ctx), size: 'M6', length: '20', x: 0, y: 0, z: 0 });
  const top = doc.nodes.length - 1;
  doc = withNode(doc, { kind: 'translate', parent: { node: top, side: 'solid' }, offset: [50, 0, 0] });
  const edit = editCommand(top, doc.nodes)!, ectx: Ctx = { doc, bodies: bodiesOf(doc), selection: { faces: [], edges: [], bodies: [0] } };
  const next = edit.build!(ectx, { ...edit.defaults!(ectx), kind: 'hex-nut' });
  assert.equal(next.nodes.length, 3, 'a nut (sketch + solid) and the move');
  assert.deepEqual((next.nodes[2] as { parent: { node: number } }).parent.node, 1);
  const [nut] = bodiesOf(next);
  assert.equal(Math.round(nut.mesh.bounds.min[0] + nut.mesh.bounds.max[0]), 100, 'still moved 50 along X');
});
