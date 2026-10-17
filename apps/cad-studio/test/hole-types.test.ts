import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { featureLabel, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { commandById, patchValues, type Ctx } from '../src/app/commands';

const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.title + ' ' + r.error.hint); return r.bodies; };
const plate = rectanglePart(32, 32, 8), pb = bodiesOf(plate);
const faceCtx = (name: string): Ctx => ({ doc: plate, bodies: pb, selection: { faces: [{ body: 0, face: pb[0].mesh.faces.find(f => f.name === name)!.index }], edges: [], bodies: [] } });
const hole = commandById('hole')!;

test('countersunk hole: a 90° cone from Ø csd down to the hole, on the top and on a side', () => {
  // (On the 8 mm side the countersink is smaller, so it stays within the plate.)
  for (const [face, k, csd] of [['n1.top', 2, 12], ['n1.side0', 1, 7.6]] as const) {
    const ctx = faceCtx(face), v = { ...hole.defaults!(ctx), type: 'countersink', d: 6.6, csd };
    const [b] = bodiesOf(hole.build!(ctx, v));
    const R = csd / 2, t = R - 3.3, frustum = Math.PI * t / 3 * (R * R + R * 3.3 + 3.3 * 3.3), cyl = Math.PI * 3.3 * 3.3;
    const thick = k === 2 ? 8 : 32, want = 32 * 32 * 8 - cyl * thick - (frustum - cyl * t);
    assert.ok(Math.abs(b.volumeMM3! - want) < 0.5, `${face}: ${b.volumeMM3} vs ${want}`);
  }
  assert.throws(() => hole.build!(faceCtx('n1.top'), { ...hole.defaults!(faceCtx('n1.top')), type: 'countersink', d: 8, csd: 6 }), /wider than the hole/);
});

test('tapped hole: the tap drill of its thread, the thread noted on the feature', () => {
  const ctx = faceCtx('n1.top'), v = patchValues(hole, ctx, hole.defaults!(ctx), { type: 'tapped', thread: 'M8' });
  assert.equal(v.d, 6.8);
  const doc = hole.build!(ctx, v), node = doc.nodes.at(-1)!;
  assert.equal(featureLabel(node, doc.nodes.length - 1, doc.nodes), 'Tapped M8×1.25');
  assert.ok(Math.abs(bodiesOf(doc)[0].volumeMM3! - (32 * 32 * 8 - Math.PI * 3.4 * 3.4 * 8)) < 2);
  const blind = hole.build!(ctx, { ...v, tend: 'blind', depth: 5 }).nodes.at(-1) as { depth?: number };
  assert.equal(blind.depth, 5);
  assert.equal(hole.steps!(ctx, { ...v, d: 7 })[0].done, false, 'not its tap drill');
});

test('hole patterns: a row and a bolt circle, one history step each; the count edits later', async () => {
  const { editFields } = await import('../src/app/editFields');
  const ctx = faceCtx('n1.top'), base = { ...hole.defaults!(ctx), d: 4, x: 6, y: 6 };
  const row = hole.build!(ctx, { ...base, pat: 'row', pn: 4, pa: 6, pb: 0 }), rn = row.nodes.at(-1)!;
  assert.equal(row.nodes.length, plate.nodes.length + 1, 'one node');
  assert.equal(featureLabel(rn, row.nodes.length - 1, row.nodes), 'Hole Ø4 × 4');
  assert.ok(Math.abs(bodiesOf(row)[0].volumeMM3! - (32 * 32 * 8 - 4 * Math.PI * 4 * 8)) < 2);
  const ring = hole.build!(ctx, { ...base, pat: 'circle', pn: 6, x: 26, y: 16, qa: 16, qb: 16 });
  const [b] = bodiesOf(ring);
  assert.ok(Math.abs(b.volumeMM3! - (32 * 32 * 8 - 6 * Math.PI * 4 * 8)) < 2);
  assert.equal(b.mesh.faces.filter(f => f.kind === 'curved').length, 6, 'six bores');
  // The count, edited from the feature.
  const f = editFields(ring.nodes, ring.nodes.length - 1).find(x => x.key === 'count')!;
  assert.ok(f && f.kind === 'number');
  const fewer = { ...ring, nodes: f.set(ring.nodes, 3) };
  assert.equal(bodiesOf(fewer)[0].mesh.faces.filter(x => x.kind === 'curved').length, 3);
  assert.throws(() => hole.build!(ctx, { ...base, pat: 'row', pn: 3, pa: 2, pb: 0 }), /longer than the hole/);
});
