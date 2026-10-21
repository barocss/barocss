import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx, type Values } from '../src/app/commands';
import { turnAbout, turnOnto } from '../src/app/alignCommand';

const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const make = (id: string, doc: StudioDoc, v: Values) => { const c = commands.find(x => x.id === id)!; return c.build!({ ...blank, doc }, { ...c.defaults!({ ...blank, doc }), ...v }); };
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.title + ' ' + r.error.hint); return r.bodies; };
const faceAt = (b: BodyResult, n: [number, number, number]) => b.mesh.faces.findIndex(f => f.kind === 'plane' && f.normal.every((x, k) => Math.abs(x - n[k]) < 1e-6));
const align = commands.find(c => c.id === 'align')!;
const round = (v: readonly number[]) => v.map(x => Math.round(x * 1000) / 1000);

test('turns that bring one axis-aligned normal onto another', () => {
  assert.equal(turnOnto([0, 0, 1], [0, 0, 1]), 'none');
  assert.deepEqual(turnOnto([1, 0, 0], [0, 0, -1]), { axis: 1, deg: 90 });
  assert.deepEqual(round(turnAbout([1, 0, 0], 1, 90)), [0, 0, -1]);
  assert.deepEqual(turnOnto([0, 0, 1], [0, 0, -1]), { axis: 0, deg: 180 });
  assert.equal(turnOnto([0.6, 0.8, 0], [0, 0, 1]), null);
});

test('Align puts a box’s bottom on another’s top, middles lined up; its side turned down onto the floor', () => {
  let doc = make('box', emptyDoc(), { w: 40, d: 40, h: 10, x: 0, y: 0, z: 0 });
  doc = make('box', doc, { w: 10, d: 10, h: 20, x: 60, y: 5, z: 3 });
  const bodies = bodiesOf(doc), small = bodies.findIndex(b => b.mesh.bounds.min[0] > 50), big = 1 - small;
  const ctx: Ctx = { doc, bodies, selection: { faces: [{ body: small, face: faceAt(bodies[small], [0, 0, -1]) }], edges: [], bodies: [] } };
  assert.ok(align.available(ctx).ok);
  const picked = align.onPick!(ctx, align.defaults!(ctx), { face: { body: big, face: faceAt(bodies[big], [0, 0, 1]) }, edge: null }) as Values;
  const out = bodiesOf(align.build!(ctx, picked)).find(b => b.mesh.bounds.max[2] > 15)!;
  assert.deepEqual([...round(out.mesh.bounds.min), ...round(out.mesh.bounds.max)], [15, 15, 10, 25, 25, 30]);
  // Its +X side onto the floor: a quarter turn, then down to Z 0.
  const side: Ctx = { ...ctx, selection: { faces: [{ body: small, face: faceAt(bodies[small], [1, 0, 0]) }], edges: [], bodies: [] } };
  const lying = bodiesOf(align.build!(side, { ...align.defaults!(side), target: 'floor' })).find(b => b.mesh.bounds.min[0] > 45)!;
  const size = [0, 1, 2].map(k => Math.round(lying.mesh.bounds.max[k] - lying.mesh.bounds.min[k]));
  assert.deepEqual([size, Math.round(lying.mesh.bounds.min[2] * 1000) / 1000], [[20, 10, 10], 0]);
  // A whole body (no face) just drops onto the floor.
  const body: Ctx = { ...ctx, selection: { faces: [], edges: [], bodies: [small] } };
  assert.equal(Math.round(bodiesOf(align.build!(body, align.defaults!(body))).find(b => b.mesh.bounds.min[0] > 50)!.mesh.bounds.min[2] * 1000), 0);
});
