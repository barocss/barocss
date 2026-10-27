import test from 'node:test';
import assert from 'node:assert/strict';
import { part, param, BarocssError, type BodyQuery } from '../src/api';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { commands, type Ctx } from '../src/app/commands';
import type { StudioDoc } from '../src/engine/doc';

// Full round (a face fillet) on a rib's top. Expectations from the inputs: a 40×30×10 box with a rib
// [10,14,9]–[30,16,top] holds 12000 + 20·2·(top − 9) − 40 mm³; rounding the 20 × 2 top takes 20·2²(4 − π)/8.
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const ribbed = (top: number) => 12000 + 40 * (top - 9) - 40;
const taken = (L: number, W: number) => L * W * W * (4 - Math.PI) / 8;
const highestTop = (b: BodyQuery) => b.faces().facing('+z').sortBy('z').last();
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r.bodies; };
const volumeOf = (doc: StudioDoc) => { const b = bodiesOf(doc); assert.equal(b.length, 1); assert.ok(b[0].volume !== null); return b[0].volume; };
const seed = () => part('full round').box({ w: 40, d: 30, h: 10 }).rib({ min: [10, 14, 9], max: [30, 16, 15] });

test('public full round: the rib top named, stored by name, its volume exact, reopened through the codec', async () => {
  const base = seed(), before = base.doc, made = base.fullRound(highestTop), doc = made.doc, node = doc.nodes.at(-1);
  assert.ok(node && node.kind === 'full-round'); assert.deepEqual(node.parent, { node: before.nodes.length - 1, side: 'solid' });
  assert.equal(node.faces.length, 1); assert.match(node.faces[0], /\.top$/); assert.equal(Object.hasOwn(node, 'along'), false);
  assert.ok(node.sigs?.[node.faces[0]], 'the face\'s signature is kept for re-matching');
  assert.deepEqual(doc.nodes.slice(0, -1), before.nodes);
  close(volumeOf(doc), ribbed(15) - taken(20, 2));
  const curved = bodiesOf(doc)[0].mesh.faces.filter(f => f.kind !== 'plane'); assert.equal(curved.length, 1); close(curved[0].radius ?? NaN, 1);
  const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc, doc);
  close(volumeOf(opened.doc), ribbed(15) - taken(20, 2));
});

test('public full round: follows an edit of the rib\'s height; along across the 20 mm length is refused, the part kept', () => {
  const base = part('full round').box({ w: 40, d: 30, h: 10 }).parameter('RibTop', 15).rib({ min: [10, 14, 9], max: [30, 16, param('RibTop')] });
  const made = base.fullRound(highestTop), taller = made.withParameters({ RibTop: 18 });
  close(volumeOf(made.doc), ribbed(15) - taken(20, 2)); close(volumeOf(taller.doc), ribbed(18) - taken(20, 2));
  const before = structuredClone(base.doc);
  assert.throws(() => base.fullRound(highestTop, { along: 'y' }), e => e instanceof BarocssError && /FULL_ROUND_NOT_CLEAR/.test(e.message));
  assert.deepEqual(base.doc, before);
  assert.throws(() => base.fullRound(b => b.faces().facing('-y').first()), e => e instanceof BarocssError && e.code === 'FULL_ROUND_PICK' && /facing up/.test(e.message));
  assert.throws(() => base.fullRound(highestTop, { along: 'z' } as never), e => e instanceof BarocssError && e.code === 'VALUE');
  assert.throws(() => base.fullRound(b => b.faces().facing('+z').where(() => false)), e => e instanceof BarocssError && e.code === 'SELECTION_EMPTY');
});

test('Studio full round: offered on a picked top, built with the longer side by default, refused on a side face', () => {
  const fullRound = commands.find(c => c.id === 'full-round')!, doc = seed().doc, bodies = bodiesOf(doc);
  const pick = (test: (n: [number, number, number], z: number) => boolean): Ctx => {
    const faces = bodies[0].mesh.faces.map((f, face) => ({ f, face })).filter(({ f }) => f.kind === 'plane' && test(f.normal, f.centroid[2]));
    return { doc, bodies, selection: { faces: faces.map(({ face }) => ({ body: 0, face })), edges: [], bodies: [] } };
  };
  const top = pick((n, z) => n[2] > 0.5 && z > 14);
  assert.equal(fullRound.available(top).ok, true);
  const v = fullRound.defaults!(top); assert.equal(v.along, 'auto'); assert.equal(fullRound.steps!(top, v)[0].done, true);
  const built = fullRound.build!(top, v), node = built.nodes.at(-1)!;
  assert.ok(node.kind === 'full-round' && !Object.hasOwn(node, 'along'));
  close(volumeOf(built), ribbed(15) - taken(20, 2));
  const alongX = fullRound.build!(top, { along: 'x' }).nodes.at(-1)!; assert.ok(alongX.kind === 'full-round' && alongX.along === 'x');
  const side = pick(n => n[1] < -0.5);
  assert.equal(fullRound.available(side).ok, false);
  assert.throws(() => fullRound.build!(side, v), /flat top faces, facing up/);
});
