import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, outputOf, massPropertiesOf } from '@barocss/cad';
import { part, BarocssError, type BodyQuery } from '../src/api';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { commands, type Ctx } from '../src/app/commands';
import type { StudioDoc } from '../src/engine/doc';

// A modelled thread on an existing round face. Expectations from the inputs: the thread's section per length is
// the kernel's own threaded rod's (the `thread` feature, built apart); a shaft is cut to a core of d/2 − 0.8·P and
// threaded, ending a relief (one pitch) short of a shoulder or of the face going on; a hole is tapped whole.
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const rodArea = (d: number, P: number) => massPropertiesOf(outputOf(evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'r', kind: 'thread', diameter: d, pitch: P, seat: 10, length: 10, form: 'helical' }] }), 'r')).volume / 10;
const cadDoc = (features: unknown[]) => ({ format: 'barocss-cad-part' as const, version: 1 as const, units: 'mm' as const, parameters: {}, features }) as Parameters<typeof evaluateCadPart>[0];
/** A modelled nut's thread section (0.04 mm clear of a bolt's): its hex prism less the nut, per height. */
const nutArea = (d: number, P: number, s = 2 * d, h = 5) => (Math.sqrt(3) / 2 * s * s * h - massPropertiesOf(outputOf(evaluateCadPart(cadDoc([{ id: 'n', kind: 'thread', diameter: d, pitch: P, seat: 0, hex: { across: s, height: h, internal: true }, form: 'helical' }])), 'n')).volume) / h;
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r.bodies; };
const volumeOf = (doc: StudioDoc) => { const b = bodiesOf(doc); assert.equal(b.length, 1); assert.ok(b[0].volume !== null); return b[0].volume; };
const round = (b: BodyQuery) => b.faces().curved().first();

test('public thread: a shaft threaded 12 from its top, stored by name, reopened through the codec', async () => {
  const base = part('shaft').cylinder({ r: 3, h: 30 }), before = base.doc, made = base.thread(round, { pitch: 1, length: 12 }), doc = made.doc, node = doc.nodes.at(-1);
  assert.ok(node && node.kind === 'face-thread'); assert.match(node.face, /\.side0$/); assert.equal(node.pitch, 1); assert.equal(node.length, 12);
  assert.equal(Object.hasOwn(node, 'diameter'), false, 'a shaft\'s thread is its own diameter'); assert.deepEqual(doc.nodes.slice(0, -1), before.nodes);
  const core = 2.2, A = rodArea(6, 1), want = Math.PI * 9 * 30 - Math.PI * (9 - core * core) * 12 + (A - Math.PI * core * core) * 11;
  close(volumeOf(doc), want);
  const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc, doc);
  close(volumeOf(opened.doc), want);
});

test('public thread: a tapped through hole at its nominal size, 0.04 mm clear of a bolt; refusals keep the part', () => {
  const base = part('plate').box({ w: 30, d: 30, h: 10 }).hole(b => b.faces().facing('+z'), { d: 5, x: 15, y: 15 });
  const tapped = base.thread(round, { pitch: 1, diameter: 6 }), node = tapped.doc.nodes.at(-1);
  assert.ok(node?.kind === 'face-thread' && !Object.hasOwn(node, 'clearance'), 'the default is not written');
  close(volumeOf(tapped.doc), 9000 - nutArea(6, 1) * 10);
  const exact = base.thread(round, { pitch: 1, diameter: 6, clearance: 0 }), n0 = exact.doc.nodes.at(-1);
  assert.ok(n0?.kind === 'face-thread' && n0.clearance === 0); close(volumeOf(exact.doc), 9000 - rodArea(6, 1) * 10);
  const lh = base.thread(round, { pitch: 1, diameter: 6, hand: 'left' }).doc.nodes.at(-1);
  assert.ok(lh?.kind === 'face-thread' && lh.hand === 'left');
  assert.throws(() => base.thread(round, { pitch: 1, diameter: 6, hand: 'up' as never }), e => e instanceof BarocssError && e.code === 'VALUE');
  assert.throws(() => part('shaft').cylinder({ r: 3, h: 30 }).thread(round, { pitch: 1, clearance: 0.04 }), e => e instanceof BarocssError && /clearance goes in the hole/.test(e.message));
  const before = structuredClone(base.doc);
  assert.throws(() => base.thread(round, { pitch: 1 }), e => e instanceof BarocssError && e.code === 'VALUE' && /nominal diameter/.test(e.message));
  assert.throws(() => base.thread(round, { pitch: 1, diameter: 5 }), e => e instanceof BarocssError && /FACE_THREAD_SIZE/.test(e.message));
  assert.throws(() => base.thread(b => b.faces().facing('+z'), { pitch: 1, diameter: 6 }), e => e instanceof BarocssError && e.code === 'THREAD_PICK');
  assert.throws(() => base.thread(round, { pitch: 1, diameter: 6, end: 'x' as never }), e => e instanceof BarocssError && e.code === 'VALUE');
  assert.deepEqual(base.doc, before);
  // A shaft's thread at another diameter than the face's.
  assert.throws(() => part('shaft').cylinder({ r: 3, h: 30 }).thread(round, { pitch: 1, diameter: 8 }), e => e instanceof BarocssError && /FACE_THREAD_SIZE.*M6, not M8/.test(e.message));
});

test('Studio thread: offered on a round face, a shaft\'s fields without a nominal, a hole\'s nominal its drill plus a pitch', () => {
  const thread = commands.find(c => c.id === 'face-thread')!;
  const ctxOf = (doc: StudioDoc, pick: (f: BodyResult['mesh']['faces'][number]) => boolean): Ctx => {
    const bodies = bodiesOf(doc), face = bodies[0].mesh.faces.findIndex(pick);
    return { doc, bodies, selection: { faces: face < 0 ? [] : [{ body: 0, face }], edges: [], bodies: [] } };
  };
  const shaft = ctxOf(part('shaft').cylinder({ r: 3, h: 30 }).doc, f => f.kind === 'curved');
  assert.equal(thread.available(shaft).ok, true);
  assert.deepEqual(thread.fields!(shaft).map(f => f.key), ['pitch', 'hand', 'len', 'end', 'relief']);
  const v = thread.defaults!(shaft); assert.deepEqual([v.pitch, v.hand, v.len, v.end, v.relief], [1, 'right', 0, '+', 1]);
  const whole = thread.build!(shaft, v), node = whole.nodes.at(-1)!;
  assert.ok(node.kind === 'face-thread' && !Object.hasOwn(node, 'length') && !Object.hasOwn(node, 'relief') && !Object.hasOwn(node, 'end') && !Object.hasOwn(node, 'hand'));
  const left = thread.build!(shaft, { ...v, hand: 'left' }), ln = left.nodes.at(-1)!;
  assert.ok(ln.kind === 'face-thread' && ln.hand === 'left'); close(volumeOf(left), rodArea(6, 1) * 30); assert.match(thread.steps!(shaft, { ...v, hand: 'left' })[1].text, /left-hand/);
  close(volumeOf(whole), rodArea(6, 1) * 30);
  const plate = ctxOf(part('plate').box({ w: 30, d: 30, h: 10 }).hole(b => b.faces().facing('+z'), { d: 5, x: 15, y: 15 }).doc, f => f.kind === 'curved');
  assert.equal(thread.available(plate).ok, true); assert.deepEqual(thread.fields!(plate).map(f => f.key), ['pitch', 'd', 'clear', 'hand', 'len', 'end']);
  const hv = thread.defaults!(plate); assert.equal(hv.d, 6, 'Ø5 drill + 1 pitch'); assert.equal(hv.clear, 0.04);
  assert.match(thread.steps!(plate, hv)[1].text, /internal, 0\.04 mm clear of a bolt/);
  close(volumeOf(thread.build!(plate, hv)), 9000 - nutArea(6, 1) * 10);
  const flat = ctxOf(part('box').box({ w: 10, d: 10, h: 10 }).doc, f => f.kind === 'plane');
  assert.equal(thread.available(flat).ok, false); assert.throws(() => thread.build!(flat, v), /round face/);
});
