import test from 'node:test';
import assert from 'node:assert/strict';
import { part, param, BarocssError, type StudioPart } from '../src/api';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { checkBrep } from '@barocss/cad';

// Frozen oracle.json: base12000 + rib240 - overlap40 =12200mm3, at density1 mass12.2g.
// Only line-only upright prismatic targets; this is not general rib, UI or manufacturing validation.
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const seed = () => part('rib').box({ w: 40, d: 30, h: 10 });
const corners = () => ({ min: [10, 14, 9] as [number, number, number], max: [30, 16, 15] as [number, number, number] });
function result(p: StudioPart, volume = 12200, top = 15) {
  const doc = p.doc, evaluated = evaluateDoc(doc, 1); assert.ok(evaluated.ok, evaluated.ok ? '' : evaluated.error.detail);
  assert.equal(evaluated.bodies.length, 1); assert.ok(evaluated.bodies[0].volume !== null); close(evaluated.bodies[0].volume, volume);
  const box = evaluated.bodies[0].mesh.bounds;
  box.min.forEach((v, i) => close(v, [0, 0, 0][i])); box.max.forEach((v, i) => close(v, [40, 30, top][i]));
  const mass = p.mass({ density: 1 }); close(mass.volume, volume); close(mass.mass, volume / 1000);
  return mass;
}

test('public rib: one rectangular addition stores the same corners and parent, evaluates and reopens through the codec', async () => {
  const base = seed(), before = base.doc, input = corners(), inputBefore = structuredClone(input), made = base.rib(input);
  const doc = made.doc, node = doc.nodes.at(-1); assert.ok(node && node.kind === 'rib');
  assert.deepEqual(node.parent, { node: before.nodes.length - 1, side: 'solid' });
  assert.deepEqual(node.min, inputBefore.min); assert.deepEqual(node.max, inputBefore.max);
  assert.deepEqual(doc.nodes.slice(0, -1), before.nodes); const expected = result(made);
  const breps = partBreps(doc); assert.equal(breps.length, 1); const brep = breps[0].brep, report = checkBrep(brep);
  assert.equal(report.valid, true, report.issues.join('; ')); assert.equal(brep.bodies.length, 1); assert.equal(brep.bodies[0].kind, 'solid');
  assert.equal(brep.shells.length, 1); assert.equal(brep.shells[0].closed, true);
  assert.deepEqual(input, inputBefore); assert.deepEqual(base.doc, before);
  input.min[0] = -100; input.max[2] = 99; assert.deepEqual(made.doc, doc); assert.deepEqual(result(made), expected);
  const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc, doc);
  assert.deepEqual(result(part('reopened rib', opened.doc)), expected); assert.deepEqual(made.doc, doc);
});

test('public rib: world corner parameter references remain stored and edits add the fixed extra prism volume', () => {
  const base = seed().parameter('RibTop', 15), before = base.doc;
  const input = { min: [10, 14, 9] as const, max: [30, 16, param('RibTop')] as const }, inputBefore = structuredClone(input);
  const made = base.rib(input), doc = made.doc, node = doc.nodes.at(-1); assert.ok(node && node.kind === 'rib');
  assert.deepEqual(node.max, [30, 16, { parameter: 'RibTop' }]); result(made);
  // Same fixed20x2 section: raising top by1 adds40mm3, independently of production output.
  const edited = made.withParameters({ RibTop: 16 }); result(edited, 12240, 16);
  const after = edited.doc.nodes.at(-1); assert.ok(after && after.kind === 'rib'); assert.deepEqual(after.max, node.max);
  assert.throws(() => made.withParameters({ RibTop: 9 }), error => error instanceof BarocssError && error.code === 'PARAMETER' && error.where === 'evaluate');
  assert.deepEqual(input, inputBefore); assert.deepEqual(base.doc, before); assert.deepEqual(made.doc, doc);
});

test('public rib: zero contact, no added material, invalid corners and unsupported curved targets refuse atomically', () => {
  const base = seed(), before = base.doc, accepted = base.rib(corners()), acceptedDoc = accepted.doc, acceptedMass = accepted.mass({ density: 1 });
  const cases = [
    { input: { min: [10, 14, 10], max: [30, 16, 15] }, code: 'GEOMETRY' },
    { input: { min: [50, 14, 9], max: [70, 16, 15] }, code: 'GEOMETRY' },
    { input: { min: [10, 14, 2], max: [30, 16, 8] }, code: 'GEOMETRY' },
    { input: { min: [10, 14, 9], max: [30, 16, 9] }, code: 'PARAMETER' },
    { input: { min: [30, 14, 9], max: [10, 16, 15] }, code: 'PARAMETER' },
    { input: { min: [NaN, 14, 9], max: [30, 16, 15] }, code: 'VALUE' },
  ];
  for (const { input, code } of cases) {
    const snapshot = structuredClone(input);
    assert.throws(() => Reflect.apply(base.rib, base, [input]), error => error instanceof BarocssError && error.code === code);
    assert.deepEqual(input, snapshot); assert.deepEqual(base.doc, before);
    assert.deepEqual(accepted.doc, acceptedDoc); assert.deepEqual(accepted.mass({ density: 1 }), acceptedMass);
  }
  const curved = part('unsupported curved rib').cylinder({ r: 10, h: 10 }), curvedBefore = curved.doc;
  assert.throws(() => curved.rib({ min: [0, -1, 9], max: [2, 1, 15] }), error => error instanceof BarocssError && error.code === 'CAPABILITY');
  assert.deepEqual(curved.doc, curvedBefore);
});

test('public rib: one-body focus semantics preserve unrelated bodies and reject an ambiguous target', () => {
  const multi = seed().box({ w: 4, d: 4, h: 4, x: 80 }), before = multi.doc, keys = multi.bodies(); assert.equal(keys.length, 2);
  assert.throws(() => multi.rib(corners()), error => error instanceof BarocssError && error.code === 'BODY_AMBIGUOUS');
  const otherBefore = multi.body(keys[1]).mass({ density: 1 }), made = multi.body(keys[0]).rib(corners());
  assert.equal(made.bodies().length, 2); close(made.mass({ density: 1 }).volume, 12200);
  assert.deepEqual(made.body(keys[1]).mass({ density: 1 }), otherBefore); assert.deepEqual(multi.doc, before);
  const implicit = seed().rib(corners()).box({ w: 4, d: 4, h: 4, x: 80 });
  assert.throws(() => implicit.select(), error => error instanceof BarocssError && error.code === 'BODY_AMBIGUOUS');
});
