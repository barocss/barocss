import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, evaluatePreview, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, usesOf, withNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx, type Values } from '../src/app/commands';
import { readStudioDoc } from '../src/engine/migrate';
import { deleteFeature } from '../src/chat/features';
import { toPartDocument } from '../src/engine/part';
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

test('linked Align retains a stable output and refuses a stale signed face before preview recovery', () => {
  const first = make('box', emptyDoc(), { w: 12, d: 10, h: 6, z: 20 });
  const seed = make('box', first, { w: 20, d: 16, h: 8, x: 40 });
  const parent = { node: 1, side: 'solid' } as const, body = { node: 3, side: 'solid' } as const;
  const aligned = withNode(seed, { kind: 'align', version: 1, parent,
    source: { feature: 'n1', face: 'n1.top', axis: 'z', sign: 1 },
    target: { body, feature: 'n3', face: 'n3.top', axis: 'z', sign: 1 }, gap: 2, lineUp: 'centre' });
  const node = aligned.nodes[4];
  assert.equal(node.kind, 'align');
  assert.deepEqual(usesOf(node), [1, 3]);
  assert.ok('error' in deleteFeature(aligned, 3));
  const native = toPartDocument(aligned).features.slice(-2);
  assert.deepEqual(native.map(n => [n.kind, n.id]), [['rotate', 'n4_alignTurn'], ['translate', 'n4']]);
  assert.deepEqual(Object.keys(aligned.outputs), ['b3', 'b4']);
  const noTurn = { ...aligned, nodes: [...seed.nodes, { ...node, source: { ...node.source, face: 'n1.bottom', sign: -1 as const } }] };
  assert.equal(toPartDocument(noTurn).features.at(-1)?.id, 'n4');
  assert.deepEqual(toPartDocument(noTurn).features.slice(4).map(n => n.kind), ['translate']);
  assert.equal(evaluatePreview(aligned, 1).ok, true);
  const stale = { ...aligned, nodes: [...seed.nodes, { ...node, target: { ...node.target, sign: -1 as const } }] };
  const result = evaluatePreview(stale, 2);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match([result.error.title, result.error.hint, result.error.detail].join(' '), /outward direction changed/);
  assert.equal(evaluatePreview(aligned, 3).ok, true);
  const invalid = { ...aligned, nodes: [...seed.nodes, { ...node, target: { ...node.target, body: { ...body, node: 4 } } }] };
  const read = readStudioDoc(JSON.stringify(invalid));
  assert.ok('error' in read && /preceding solids/.test(read.error));
});
