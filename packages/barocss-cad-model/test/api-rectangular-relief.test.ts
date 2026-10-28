import test from 'node:test';
import assert from 'node:assert/strict';
import { part, param, BarocssError, type StudioPart } from '../src/api';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { checkBrep } from '@barocss/cad';

// Frozen oracle SHA404abc1624d967ad0e0b87c290255d19a2c3c76c28b6a699fad4ff3e30e8bdb3.
// Rectangular +Z top relief on one line-only upright slab; not text, arbitrary faces or curved embossing.
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
type Mode = 'emboss' | 'engrave';
const seed = () => part('rectangular relief').box({ w: 40, d: 30, h: 10 });
const options = (mode: Mode) => ({ min: [10, 12] as [number, number], max: [30, 18] as [number, number], depth: 3, mode });
function result(p: StudioPart, volume: number, top: number) {
  const doc = p.doc, evaluated = evaluateDoc(doc, 1); assert.ok(evaluated.ok, evaluated.ok ? '' : evaluated.error.detail);
  assert.equal(evaluated.bodies.length, 1); assert.ok(evaluated.bodies[0].volume !== null); close(evaluated.bodies[0].volume, volume);
  const bounds = evaluated.bodies[0].mesh.bounds;
  bounds.min.forEach((v, i) => close(v, [0, 0, 0][i])); bounds.max.forEach((v, i) => close(v, [40, 30, top][i]));
  const mass = p.mass({ density: 1 }); close(mass.volume, volume); close(mass.mass, volume / 1000);
  return mass;
}

test('public rectangular relief: the fixed emboss and engrave inputs store, evaluate and reopen without changing the source', async () => {
  for (const [mode, volume, top] of [['emboss', 12360, 13], ['engrave', 11640, 10]] as const) {
    const base = seed(), before = base.doc, input = options(mode), inputBefore = structuredClone(input), made = base.rectangularRelief(input);
    const doc = made.doc, node = doc.nodes.at(-1); assert.ok(node && node.kind === 'rectangular-relief');
    assert.deepEqual(node.parent, { node: before.nodes.length - 1, side: 'solid' });
    assert.deepEqual(node.min, inputBefore.min); assert.deepEqual(node.max, inputBefore.max); assert.equal(node.depth, 3); assert.equal(node.mode, mode);
    assert.deepEqual(doc.nodes.slice(0, -1), before.nodes); const expected = result(made, volume, top);
    const all = partBreps(doc); assert.equal(all.length, 1); const brep = all[0].brep, checked = checkBrep(brep);
    assert.equal(checked.valid, true, checked.issues.join('; ')); assert.equal(brep.bodies.length, 1); assert.equal(brep.bodies[0].kind, 'solid');
    assert.equal(brep.shells.length, 1); assert.equal(brep.shells[0].closed, true);
    assert.deepEqual(input, inputBefore); input.min[0] = -100; input.depth = 99;
    assert.deepEqual(made.doc, doc); assert.deepEqual(result(made, volume, top), expected); assert.deepEqual(base.doc, before);
    const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc, doc);
    assert.deepEqual(result(part('reopened relief', opened.doc), volume, top), expected);
  }
});

test('public rectangular relief: stored depth and footprint parameters survive edits and refused values preserve accepted state', () => {
  for (const mode of ['emboss', 'engrave'] as const) {
    const base = seed().parameter('ReliefDepth', 3).parameter('Left', 10), before = base.doc;
    const input = { ...options(mode), min: [param('Left'), 12] as const, depth: param('ReliefDepth') }, inputBefore = structuredClone(input);
    const made = base.rectangularRelief(input), doc = made.doc, node = doc.nodes.at(-1); assert.ok(node && node.kind === 'rectangular-relief');
    assert.deepEqual(node.min, [{ parameter: 'Left' }, 12]); assert.deepEqual(node.depth, { parameter: 'ReliefDepth' });
    const original = made.mass({ density: 1 });
    // Fixed footprint20x6: depth4 adds/removes480mm3, not the full tool volume960mm3.
    const edited = made.withParameters({ ReliefDepth: 4 }); result(edited, mode === 'emboss' ? 12480 : 11520, mode === 'emboss' ? 14 : 10);
    const after = edited.doc.nodes.at(-1); assert.ok(after && after.kind === 'rectangular-relief');
    assert.deepEqual(after.min, node.min); assert.deepEqual(after.depth, node.depth); assert.equal(after.mode, mode);
    for (const depth of [0, 10, 11]) assert.throws(() => made.withParameters({ ReliefDepth: depth }), error => error instanceof BarocssError && error.code === 'PARAMETER' && error.where === 'evaluate');
    assert.throws(() => made.withParameters({ Left: -1 }), error => error instanceof BarocssError && error.code === 'GEOMETRY' && error.where === 'evaluate');
    assert.deepEqual(input, inputBefore); assert.deepEqual(base.doc, before); assert.deepEqual(made.doc, doc); assert.deepEqual(made.mass({ density: 1 }), original);
  }
});

test('public rectangular relief: malformed inputs, unsupported targets and unsupported footprint support refuse atomically', () => {
  const base = seed(), before = base.doc, accepted = base.rectangularRelief(options('emboss')), acceptedDoc = accepted.doc, mass = accepted.mass({ density: 1 });
  const cases = [
    { input: { ...options('emboss'), min: [40, 12], max: [45, 18] }, code: 'GEOMETRY' },
    { input: { ...options('engrave'), min: [40, 30], max: [45, 35] }, code: 'GEOMETRY' },
    { input: { ...options('emboss'), min: [41, 12], max: [45, 18] }, code: 'GEOMETRY' },
    { input: { ...options('engrave'), min: [35, 12], max: [45, 18] }, code: 'GEOMETRY' },
    { input: { ...options('emboss'), min: [10, 12], max: [10, 18] }, code: 'PARAMETER' },
    { input: { ...options('emboss'), min: [30, 12], max: [10, 18] }, code: 'PARAMETER' },
    { input: { ...options('emboss'), depth: 0 }, code: 'PARAMETER' },
    { input: { ...options('engrave'), depth: 10 }, code: 'PARAMETER' },
    { input: { ...options('emboss'), depth: 11 }, code: 'PARAMETER' },
    { input: { ...options('emboss'), depth: NaN }, code: 'VALUE' },
    { input: { ...options('emboss'), mode: 'text' }, code: 'VALUE' },
    { input: { ...options('emboss'), text: 'not supported' }, code: 'VALUE' },
  ];
  for (const { input, code } of cases) {
    const snapshot = structuredClone(input);
    assert.throws(() => Reflect.apply(base.rectangularRelief, base, [input]), error => error instanceof BarocssError && error.code === code);
    assert.deepEqual(input, snapshot); assert.deepEqual(base.doc, before); assert.deepEqual(accepted.doc, acceptedDoc); assert.deepEqual(accepted.mass({ density: 1 }), mass);
  }
  const curved = part('unsupported curved relief').cylinder({ r: 30, h: 10 }), curvedBefore = curved.doc;
  assert.throws(() => curved.rectangularRelief(options('emboss')), error => error instanceof BarocssError && error.code === 'CAPABILITY');
  assert.deepEqual(curved.doc, curvedBefore);
  const empty = part('no relief target'), emptyBefore = empty.doc;
  assert.throws(() => empty.rectangularRelief(options('emboss')), error => error instanceof BarocssError && error.code === 'NO_BODY'); assert.deepEqual(empty.doc, emptyBefore);
});

test('public rectangular relief: null focus stays ambiguous and explicit focus preserves the other body', () => {
  const multi = seed().box({ w: 4, d: 4, h: 4, x: 80 }), before = multi.doc, keys = multi.bodies(); assert.equal(keys.length, 2);
  assert.throws(() => multi.rectangularRelief(options('emboss')), error => error instanceof BarocssError && error.code === 'BODY_AMBIGUOUS');
  const other = multi.body(keys[1]).mass({ density: 1 }), made = multi.body(keys[0]).rectangularRelief(options('emboss'));
  assert.equal(made.bodies().length, 2); close(made.mass({ density: 1 }).volume, 12360); assert.deepEqual(made.body(keys[1]).mass({ density: 1 }), other); assert.deepEqual(multi.doc, before);
  const implicit = seed().rectangularRelief(options('engrave')).box({ w: 4, d: 4, h: 4, x: 80 });
  assert.throws(() => implicit.select(), error => error instanceof BarocssError && error.code === 'BODY_AMBIGUOUS');
});
